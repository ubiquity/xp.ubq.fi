# Project Brief

## Overview
A minimal frontend application built with **HTML**, **CSS**, and **TypeScript**, bundled using **esbuild**, and managed with **Bun**. The app includes functionality to download and store build artifacts from a remote API.

## Core Goals
- Provide a lightweight, framework-free frontend template.
- Enable fast development with Bun and esbuild.
- Support downloading and unzipping GitHub artifacts directly in the browser.
- Minimize backend to auth proxy only (due to Deno Deploy limitations).
- Be easily deployable as static files.
- Provide instant developer analytics visualizations (leaderboard, time series) from IndexedDB-cached data.
- Enforce strict UI & CSS constraints: only essential CSS, no colors, only PX units in multiples of 4px, all design in visualizations.

## Out of Scope
- No complex backend logic; focus is on frontend and artifact handling.

## Status
The project includes a Bun + TypeScript frontend with Rust/WASM components for artifact unzipping. Backend is strictly an auth proxy for GitHub artifacts due to Deno Deploy compute limitations (50ms).

Planning and implementation of analytics/visualization UI is underway. All UI work will strictly follow the minimal CSS and 4px interval policy.
