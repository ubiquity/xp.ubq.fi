# Project Brief: Developer Analytics & Manager Insights

## 1. Overview

This project involves a minimal frontend application built with **HTML**, **CSS**, and **TypeScript**, bundled using **esbuild** and managed with **Bun**. The application downloads, stores, and visualizes build artifacts and contribution data (`rawData`) from remote APIs.

A key objective is to analyze the contribution data (`rawData`) to identify and document actionable insights for engineering managers regarding their team's performance, collaboration patterns, and overall project health, leveraging the application's data processing capabilities.

## 2. Core Goals

*   **Technical Foundation:**
    *   Provide a lightweight, framework-free frontend template.
    *   Enable fast development with Bun and esbuild.
    *   Support downloading and unzipping GitHub artifacts directly in the browser.
    *   Minimize backend to an auth proxy only (due to Deno Deploy limitations).
    *   Ensure easy deployment as static files.
*   **Analytics & Insights:**
    *   Provide instant developer analytics visualizations (e.g., leaderboards, time series) from IndexedDB-cached data.
    *   Analyze the structure and content of the contribution `rawData`.
    *   Identify and document key metrics and potential insights derivable from `rawData` relevant to engineering management.
    *   Create comprehensive documentation outlining these manager insights, their value, and how they connect to the source data.
    *   Establish a clear foundation for potentially building more advanced dashboards or reports in the future.
*   **Design Constraints:**
    *   Enforce strict UI & CSS constraints: essential CSS only, no colors, only PX units in multiples of 4px, with primary design focus within visualizations.

## 3. Scope

*   **Technical Implementation (In Scope):**
    *   Frontend development using HTML, CSS, TypeScript, Bun, esbuild.
    *   Rust/WASM components for artifact unzipping.
    *   Auth proxy backend for GitHub artifacts.
    *   IndexedDB caching for analytics data.
    *   Basic analytics visualizations (leaderboard, time series).
*   **Data Analysis & Documentation (In Scope):**
    *   Analysis of the provided JSON `rawData` structure.
    *   Definition and documentation of insights for engineering managers (individual performance, team dynamics, project health) based *solely* on the `rawData` structure.
    *   Creation and maintenance of core documentation files (`project-brief.md`, `product-context.md`, `system-patterns.md`, `tech-context.md`, `active-context.md`, `progress.md`).
*   **Out of Scope:**
    *   Complex backend logic beyond the auth proxy.
    *   Processing or analyzing the *actual values* within the `rawData` for the *initial documentation phase*.
    *   Building advanced visualization tools, dashboards, or reporting mechanisms beyond the initial scope.
    *   Integrating with external data sources not provided initially.
    *   Making subjective judgments about performance; the focus is on documenting *potential* objective insights based on the data structure.

## 4. Status & Deliverables

*   **Current Status:** The project includes a Bun + TypeScript frontend with Rust/WASM components for artifact unzipping and an auth proxy backend. Planning and implementation of analytics/visualization UI are underway, adhering to strict design constraints. The initial documentation phase for engineering manager insights is in progress.
*   **Deliverables:**
    *   A functional frontend application meeting the technical goals.
    *   A set of core documentation files within the `docs/` directory detailing the project and the potential engineering management insights derived from the `rawData`.
