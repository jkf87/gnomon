# Reviewer 1: Install Correctness
Dimension: Install accuracy and robustness (70% auto-test + 30% qualitative).
Auto-Test: verification/auto/run_install_test.sh. Exit 0 = pass.
Qualitative: Idempotency, rollback safety, old ouroboros cleanup.
Score: 90-100 (all pass) | 75-89 (1-2 gaps) | 50-74 (major) | <50 (critical)
