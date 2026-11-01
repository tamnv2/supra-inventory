import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("e109_scope", ROOT / "tools/d173_e109_code_scope_guard.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class CodeOnlyScopeTests(unittest.TestCase):
    def setUp(self):
        import json
        self.approval = json.loads((ROOT / "ops/d173-e109-code-authorization.json").read_text(encoding="utf-8"))
        self.base = 'name = "supra-inventory-beta"\n[assets]\n' + guard.ANCHOR + '[vars]\nAPP_ENV = "beta"\n'
        self.candidate = self.base.replace(guard.ANCHOR, guard.ASSET_ROUTING, 1)

    def test_exact_code_only_asset_change_passes(self):
        guard.validate(self.approval, self.base, self.candidate, [guard.CONFIG, "service/src/read-api.ts"])

    def test_every_release_provider_or_d172_permission_stays_false(self):
        for field in ("merge_main_permission", "deployment_permission", "provider_write_permission",
                      "ota_publication_permission", "stable_permission", "d172_business_changes"):
            with self.subTest(field=field):
                approval = copy.deepcopy(self.approval)
                approval[field] = True
                with self.assertRaises(AssertionError):
                    guard.validate(approval, self.base, self.candidate, [guard.CONFIG])

    def test_unapproved_or_missing_code_authority_fails_closed(self):
        for field, value in (("code_permission", False), ("checkpoint_id", "D173-E108"),
                             ("status", "PROPOSED"), ("stop_at", "DEPLOYED")):
            with self.subTest(field=field):
                approval = copy.deepcopy(self.approval)
                approval[field] = value
                with self.assertRaises(AssertionError):
                    guard.validate(approval, self.base, self.candidate, [guard.CONFIG])

    def test_api_bypass_resource_or_other_config_change_is_rejected(self):
        for candidate in (self.candidate.replace("!/assets/*", "!/api/*"),
                          self.candidate.replace("supra-inventory-beta", "supra-inventory-stable"),
                          self.candidate + '\n[[kv_namespaces]]\nbinding = "NEW_RESOURCE"\n'):
            with self.subTest(candidate=candidate):
                with self.assertRaises(AssertionError):
                    guard.validate(self.approval, self.base, candidate, [guard.CONFIG])

    def test_independent_provider_d172_and_stable_paths_are_rejected(self):
        for path in ("firebase/firestore.rules", "firebase.json", "obpp1291/android/app.kt",
                     "service/src/obpp1291-core.ts", "service/wrangler.stable.toml",
                     ".github/workflows/deploy-stable.yml", ".github/workflows/deploy-beta-firestore.yml",
                     "ops/project-scope.json", "ops/resource-registry.json"):
            with self.subTest(path=path):
                with self.assertRaises(AssertionError):
                    guard.validate(self.approval, self.base, self.candidate, [guard.CONFIG, path])

    def test_changed_or_ambiguous_main_baseline_requires_review(self):
        for previous in (self.base.replace(guard.ANCHOR, "run_worker_first = false\n"), self.base + guard.ANCHOR):
            with self.assertRaises(AssertionError):
                guard.validate(self.approval, previous, self.candidate, [guard.CONFIG])


if __name__ == "__main__":
    unittest.main()
