#!/usr/bin/env python3
"""Instala Escriba Oveja desde su release publica en un servidor Foundry VTT.

El programa no recibe ni almacena tokens. Toda autenticacion se delega a
GitHub CLI (`gh`), que debe estar conectado previamente mediante `gh auth login`.
"""

from __future__ import annotations

import argparse
from contextlib import ExitStack
import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from zipfile import ZipFile


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MANIFEST = SCRIPT_DIR / "escriba-oveja-install-manifest.json"


class InstallError(RuntimeError):
    pass


def fail(message: str) -> None:
    raise InstallError(message)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Descarga, valida e instala Escriba Oveja."
    )
    parser.add_argument(
        "--data-dir",
        required=True,
        type=Path,
        help="Directorio Data de Foundry; los modulos viven en Data/modules.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help="Manifest de instalacion descargado junto a este instalador.",
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="MODULE_ID",
        help="Instala solamente este modulo; puede repetirse.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Descarga y valida todo, pero no modifica Foundry.",
    )
    parser.add_argument(
        "--confirm-foundry-stopped",
        action="store_true",
        help="Confirma que Foundry esta detenido antes de reemplazar modulos.",
    )
    return parser.parse_args()


def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        fail(f"No existe el manifest: {path}")
    except json.JSONDecodeError as error:
        fail(f"El manifest no es JSON valido: {error}")

    if data.get("schemaVersion") != 1 or data.get("channel") != "public":
        fail("El manifest no pertenece al canal publico compatible.")
    modules = data.get("modules")
    if not isinstance(modules, list) or len(modules) != 1:
        fail("Este instalador admite exactamente un modulo: Escriba Oveja.")

    required = {"id", "version", "repository", "release", "asset", "sha256"}
    seen: set[str] = set()
    for module in modules:
        if not isinstance(module, dict) or not required.issubset(module):
            fail("Una entrada del manifest esta incompleta.")
        module_id = module["id"]
        if module_id != "eco-mistico-escriba-oveja" or module["repository"] != "188233/eco-mistico-escriba-oveja":
            fail("Este instalador solo puede modificar Escriba Oveja desde su repositorio oficial.")
        version = str(module["version"])
        if not re.fullmatch(r"\d+\.\d+\.\d+", version):
            fail("Version no compatible.")
        if module["release"] != f"v{version}" or module["asset"] != f"{module_id}-{version}.zip":
            fail("La release o el nombre del ZIP no coincide con la version.")
        if module_id in seen:
            fail(f"Modulo duplicado en el manifest: {module_id}")
        seen.add(module_id)
        digest = str(module["sha256"]).upper()
        if len(digest) != 64 or any(char not in "0123456789ABCDEF" for char in digest):
            fail(f"SHA-256 invalido para {module_id}.")
        module["sha256"] = digest
    return data


def selected_modules(manifest: dict, requested: list[str]) -> list[dict]:
    modules = manifest["modules"]
    if not requested:
        return modules
    wanted = set(requested)
    known = {module["id"] for module in modules}
    unknown = sorted(wanted - known)
    if unknown:
        fail(f"Modulos desconocidos en --only: {', '.join(unknown)}")
    return [module for module in modules if module["id"] in wanted]


def require_command(name: str) -> str:
    executable = shutil.which(name)
    if not executable:
        fail(f"No se encontro el comando requerido: {name}")
    return executable


def run(command: list[str], *, quiet: bool = False) -> None:
    result = subprocess.run(
        command,
        stdout=subprocess.DEVNULL if quiet else None,
        stderr=subprocess.DEVNULL if quiet else None,
        check=False,
    )
    if result.returncode:
        fail(f"Fallo el comando ({result.returncode}): {' '.join(command)}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def safe_zip_member(name: str, module_id: str) -> bool:
    if not name or "\\" in name or ":" in name or name.startswith("/"):
        return False
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        return False
    return path.parts[0] == module_id


def validate_and_extract(archive: Path, module: dict, staging_root: Path) -> Path:
    expected_hash = module["sha256"]
    actual_hash = sha256(archive)
    if actual_hash != expected_hash:
        fail(
            f"Hash incorrecto para {module['id']}: esperado {expected_hash}, "
            f"recibido {actual_hash}."
        )

    with ZipFile(archive) as bundle:
        names = bundle.namelist()
        if not names or len(names) != len(set(names)):
            fail(f"ZIP vacio o con rutas duplicadas: {archive.name}")
        unsafe = [name for name in names if not safe_zip_member(name, module["id"])]
        if unsafe:
            fail(f"ZIP con ruta insegura o raiz incorrecta: {unsafe[0]}")
        if any((entry.external_attr >> 16) & 0o170000 == 0o120000 for entry in bundle.infolist()):
            fail("El ZIP contiene enlaces simbolicos.")
        manifest_name = f"{module['id']}/module.json"
        if manifest_name not in names:
            fail(f"{archive.name} no contiene {manifest_name}.")
        try:
            embedded = json.loads(bundle.read(manifest_name).decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            fail(f"module.json invalido dentro de {archive.name}: {error}")
        if embedded.get("id") != module["id"]:
            fail(f"ID inesperado dentro de {archive.name}: {embedded.get('id')}")
        if str(embedded.get("version")) != str(module["version"]):
            fail(
                f"Version inesperada para {module['id']}: "
                f"{embedded.get('version')} != {module['version']}"
            )
        bundle.extractall(staging_root)

    staged = staging_root / module["id"]
    if not staged.is_dir():
        fail(f"La extraccion no produjo {staged}.")
    return staged


def preserve_owner(target: Path, owner: tuple[int, int] | None) -> None:
    if owner is None or not hasattr(os, "chown"):
        return
    uid, gid = owner
    for root, directories, files in os.walk(target):
        os.chown(root, uid, gid)
        for name in directories:
            os.chown(Path(root) / name, uid, gid)
        for name in files:
            os.chown(Path(root) / name, uid, gid)


def install(staged: dict[str, Path], modules_dir: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_root = modules_dir / ".eco-mistico-backups" / timestamp
    backup_root.mkdir(parents=True, exist_ok=False)

    owners: dict[str, tuple[int, int] | None] = {}
    moved_to_backup: list[str] = []
    installed: list[str] = []
    rollback_root = backup_root / ".rollback-new"

    try:
        for module_id in staged:
            target = modules_dir / module_id
            if target.is_symlink():
                fail("El destino de Escriba Oveja no puede ser un enlace simbolico.")
            owners[module_id] = None
            if target.exists():
                stat = target.stat()
                owners[module_id] = (stat.st_uid, stat.st_gid)
                os.replace(target, backup_root / module_id)
                moved_to_backup.append(module_id)

        for module_id, source in staged.items():
            target = modules_dir / module_id
            os.replace(source, target)
            installed.append(module_id)
            preserve_owner(target, owners[module_id])
    except Exception:
        rollback_root.mkdir(parents=True, exist_ok=True)
        for module_id in reversed(installed):
            target = modules_dir / module_id
            if target.exists():
                os.replace(target, rollback_root / module_id)
        for module_id in reversed(moved_to_backup):
            backup = backup_root / module_id
            if backup.exists():
                os.replace(backup, modules_dir / module_id)
        raise

    return backup_root


def main() -> int:
    args = parse_args()
    manifest_path = args.manifest.expanduser().resolve()
    manifest = load_manifest(manifest_path)
    modules = selected_modules(manifest, args.only)

    data_dir = args.data_dir.expanduser().resolve()
    if data_dir == Path("/") or data_dir == Path.home().resolve():
        fail("--data-dir debe ser el directorio Data exacto de Foundry, no / ni HOME.")
    if not data_dir.is_dir():
        fail(f"El directorio Data de Foundry no existe: {data_dir}")
    modules_dir = (data_dir / "modules").resolve()
    if data_dir not in modules_dir.parents:
        fail(f"El directorio de modulos salio de Data: {modules_dir}")
    if args.dry_run:
        if not modules_dir.is_dir():
            fail(f"El directorio de modulos de Foundry no existe: {modules_dir}")
    else:
        modules_dir.mkdir(parents=True, exist_ok=True)

    gh = require_command("gh")
    run([gh, "auth", "status"], quiet=True)

    if not args.dry_run and not args.confirm_foundry_stopped:
        fail(
            "Detene Foundry y repeti con --confirm-foundry-stopped. "
            "Tambien podes usar primero --dry-run."
        )

    print(f"Canal: {manifest['channel']}")
    print(f"Foundry esperado: {manifest.get('foundryVersion', 'sin declarar')}")
    print("Sistema: independiente; no modifica reglas ni otros modulos.")
    print(f"Destino: {modules_dir}")

    with ExitStack() as temporary_directories:
        temporary = temporary_directories.enter_context(
            tempfile.TemporaryDirectory(prefix="escriba-oveja-")
        )
        temp_root = Path(temporary)
        download_root = temp_root / "downloads"
        if args.dry_run:
            staging_root = temp_root / "staging"
            staging_root.mkdir()
        else:
            staging_temporary = temporary_directories.enter_context(
                tempfile.TemporaryDirectory(prefix=".eco-mistico-staging-", dir=modules_dir)
            )
            staging_root = Path(staging_temporary)
        download_root.mkdir()
        staged: dict[str, Path] = {}

        for module in modules:
            print(
                f"Descargando {module['id']} {module['version']} "
                f"desde {module['repository']}..."
            )
            run(
                [
                    gh,
                    "release",
                    "download",
                    module["release"],
                    "--repo",
                    module["repository"],
                    "--pattern",
                    module["asset"],
                    "--dir",
                    str(download_root),
                    "--clobber",
                ]
            )
            archive = download_root / module["asset"]
            if not archive.is_file():
                fail(f"GitHub no entrego el archivo esperado: {archive.name}")
            staged[module["id"]] = validate_and_extract(archive, module, staging_root)
            print(f"Validado: {module['asset']} ({module['sha256']})")

        if args.dry_run:
            print("Prueba terminada: descargas, hashes, versiones y ZIPs son validos.")
            return 0

        backup = install(staged, modules_dir)
        print("Instalacion terminada.")
        print(f"Respaldo recuperable: {backup}")
        for module in modules:
            print(f"  - {module['id']}: {module['version']}")
        print("Ya podes iniciar Foundry nuevamente.")
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except InstallError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
