# Project Brief: Developer Performance Analytics Dashboard

## Project Overview

We are building a data visualization dashboard for analyzing developer performance metrics from the `text-conversation-rewards` module. This module currently generates rewards for participation on GitHub, and we will repurpose its output data for performance analytics, providing engineering managers and team leads with insights into developer activities and contributions.

## Core Requirements

1. Connect to Supabase to fetch rewards data outputted by the `text-conversation-rewards` module
2. Create a flexible visualization system that can:
   - Map any permutation of metrics to different visualization types
   - Automatically select appropriate chart types based on data dimensions
   - Support filtering, grouping, and aggregation of data
3. Visualize various metrics including:
   - Comment quality (word count, readability, relevance)
   - Code review statistics
   - Contribution patterns across repositories
   - Time-based activity metrics
4. Provide an intuitive interface for engineering managers to derive insights without requiring deep technical knowledge

## Goals

### Primary Goals
- Enable data-driven performance assessment of developers
- Provide visibility into contribution quality beyond quantity
- Help identify areas where developers excel or need improvement
- Support team management decisions with objective metrics

### Technical Goals
- Create a modular, maintainable visualization framework
- Implement a smart chart selection system
- Ensure responsive performance with potentially large datasets
- Support any permutation of metrics in visualizations

## Constraints

- Must use the existing data structure from the `text-conversation-rewards` module
- Dashboard should be web-based and accessible to engineering managers
- Should support various device sizes for accessibility

## Success Criteria

The project will be considered successful when:
1. Engineering managers can easily visualize any combination of performance metrics
2. The system automatically suggests appropriate visualization types
3. Data insights are easily discoverable through an intuitive interface
4. The dashboard supports drilling down from high-level overviews to detailed metrics
