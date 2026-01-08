# Test Program - Solana Program

Minimal source bundle for public verification of the on-chain program.

## Program
- Program ID: `GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z`

## Toolchain
- Anchor: **0.31.1** (must use this exact version)
- Solana program crate: 2.3.0
- Rust edition: 2021
- Build command: `anchor build --locked`

## Project layout
```
Anchor.toml
Cargo.toml
Cargo.lock
programs/test_program/Cargo.toml
programs/test_program/src/**   (all source files)
```

## Verify via OtterSec API
Request (async):
```bash
curl -X POST https://verify.osec.io/verify \
  -H "Content-Type: application/json" \
  -d '{
    "repository": "https://github.com/uniwexLab/test_program",
    "program_id": "GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z",
    "commit_hash": "REPLACE_WITH_COMMIT",
    "lib_name": "test_program"
  }'
```

Check status:
```bash
curl https://verify.osec.io/status/GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z | jq
```

Build logs:
```bash
curl https://verify.osec.io/logs/GZzqLG5WuHm9fipCh5PsEyo841F7Kbz9YvNRYynQQY2Z | jq
```

## Notes
- Keep the repository public and pinned to the exact commit used for verification.
- Do not include private keys, target/ artifacts, or `.so` binaries in the repo.

