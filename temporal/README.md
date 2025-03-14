# Temporal Workflows for Infinity DEX

This directory contains all Temporal-related code for the Infinity DEX project.

## Directory Structure

- `activities/`: Contains all Temporal activity implementations
  - `price_activities.go`: Activities for price oracle
  - `db_activities.go`: Activities for database operations

- `workflows/`: Contains all Temporal workflow definitions
  - `price_workflow.go`: Workflow for price oracle

- `workers/`: Contains worker implementations
  - `price/`: Worker for price oracle workflows

## Usage

To run the workers:

```bash
# Run the price oracle worker
make run-price-worker
```

## Development

When adding new activities or workflows, please follow these conventions:

1. Place activities in the `activities/` directory with the `temporal_activities` package
2. Place workflows in the `workflows/` directory with the `temporal_workflows` package
3. Update worker implementations in the `workers/` directory as needed 