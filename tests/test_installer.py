import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("oveja_installer", ROOT / "tools/install-escriba-oveja.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)
MODULE_ID = "eco-mistico-escriba-oveja"


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="oveja-installer-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.data = self.root / "Data"
        self.modules = self.data / "modules"
        self.modules.mkdir(parents=True)
        self.manifest_path = ROOT / "dist/escriba-oveja-install-manifest.json"
        self.manifest = installer.load_manifest(self.manifest_path)
        self.module = self.manifest["modules"][0]
        self.zip = ROOT / "dist" / self.module["asset"]

    def test_real_package_hash_id_version_and_extraction(self):
        staged = installer.validate_and_extract(self.zip, self.module, self.root / "staging")
        manifest = json.loads((staged / "module.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], "0.2.0")
        self.assertTrue((staged / "scripts/media.js").is_file())
        wrong = dict(self.module, sha256="0" * 64)
        with self.assertRaises(installer.InstallError):
            installer.validate_and_extract(self.zip, wrong, self.root / "wrong")

    def test_manifest_only_accepts_oveja_and_matching_release(self):
        for key, value in [("id", "eco-mistico-core"), ("repository", "someone/else"), ("asset", "../bad.zip"), ("release", "main")]:
            manifest = json.loads(self.manifest_path.read_text())
            manifest["modules"][0][key] = value
            path = self.root / "invalid.json"
            path.write_text(json.dumps(manifest))
            with self.assertRaises(installer.InstallError):
                installer.load_manifest(path)

    def test_traversal_and_embedded_version_are_rejected(self):
        for entry, version in [(f"{MODULE_ID}/../outside.txt", "0.2.0"), (f"{MODULE_ID}/safe.txt", "9.9.9")]:
            archive = self.root / "bad.zip"
            with ZipFile(archive, "w") as bundle:
                bundle.writestr(f"{MODULE_ID}/module.json", json.dumps({"id": MODULE_ID, "version": version}))
                bundle.writestr(entry, "not allowed")
            module = dict(self.module, sha256=installer.sha256(archive))
            with self.assertRaises(installer.InstallError):
                installer.validate_and_extract(archive, module, self.root / "bad-staging")
        self.assertFalse((self.root / "outside.txt").exists())

    def test_install_keeps_backup_and_other_modules(self):
        target = self.modules / MODULE_ID
        target.mkdir()
        (target / "old.txt").write_text("previous version")
        core = self.modules / "eco-mistico-core"
        core.mkdir()
        (core / "untouched.txt").write_text("preserve")
        staged = installer.validate_and_extract(self.zip, self.module, self.modules / ".test-staging")
        backup = installer.install({MODULE_ID: staged}, self.modules)
        self.assertEqual((backup / MODULE_ID / "old.txt").read_text(), "previous version")
        self.assertTrue((target / "module.json").is_file())
        self.assertEqual((core / "untouched.txt").read_text(), "preserve")

    def test_owner_failure_restores_previous_module(self):
        target = self.modules / MODULE_ID
        target.mkdir()
        (target / "old.txt").write_text("previous version")
        staged = installer.validate_and_extract(self.zip, self.module, self.modules / ".test-staging")
        with patch.object(installer, "preserve_owner", side_effect=OSError("simulated chown failure")):
            with self.assertRaises(OSError):
                installer.install({MODULE_ID: staged}, self.modules)
        self.assertEqual((target / "old.txt").read_text(), "previous version")
        self.assertFalse((target / "module.json").exists())

    def test_dry_run_does_not_change_data(self):
        def run(command, **_kwargs):
            if "download" in command:
                dest = Path(command[command.index("--dir") + 1])
                shutil.copyfile(self.zip, dest / self.zip.name)
        args = ["installer", "--data-dir", str(self.data), "--manifest", str(self.manifest_path), "--dry-run"]
        with patch("sys.argv", args), patch.object(installer, "require_command", return_value="gh"), patch.object(installer, "run", side_effect=run):
            self.assertEqual(installer.main(), 0)
        self.assertEqual(list(self.modules.iterdir()), [])

    def test_install_requires_stopped_confirmation(self):
        args = ["installer", "--data-dir", str(self.data), "--manifest", str(self.manifest_path)]
        with patch("sys.argv", args), patch.object(installer, "require_command", return_value="gh"), patch.object(installer, "run"):
            with self.assertRaises(installer.InstallError):
                installer.main()
        self.assertEqual(list(self.modules.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
