# Fr33d0m OpenClaw

An OpenClaw-based Fr33d0m VM project.

## Direction

This project is intended to use:

- OpenClaw Gateway as the backend/runtime
- a lighter Fr33d0m-branded admin shell as the operator UI
- Ubuntu Desktop on DigitalOcean as the base VM image
- snapshot-based deployment after the VM is configured and validated

## Goals

- install and configure OpenClaw cleanly on Ubuntu
- provide a Fr33d0m-style dashboard for setup and operations
- expose browser terminal access safely
- support a repeatable image/snapshot workflow

## Initial plan

1. Script OpenClaw install and daemon setup on Ubuntu.
2. Decide how much of the built-in OpenClaw Control UI to reuse.
3. Build a Fr33d0m admin shell around the real OpenClaw runtime.
4. Add VM-friendly operational tooling and documentation.

## Status

Local repo initialized and ready for implementation.
