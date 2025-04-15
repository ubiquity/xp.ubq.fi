import React from 'react';
import type { DataDimension } from '../types/data-types';

interface DimensionSelectorProps {
  availableDimensions: DataDimension[];
  selectedDimensions: DataDimension[];
  onSelectDimension: (dimension: DataDimension) => void;
  onRemoveDimension: (dimension: DataDimension) => void;
  maxSelections?: number;
}

/**
 * Component for selecting data dimensions to visualize
 */
const DimensionSelector: React.FC<DimensionSelectorProps> = ({
  availableDimensions,
  selectedDimensions,
  onSelectDimension,
  onRemoveDimension,
  maxSelections = 3
}) => {
  // Filter dimensions that aren't already selected
  const unselectedDimensions = availableDimensions.filter(
    dim => !selectedDimensions.some(selected => selected.id === dim.id)
  );

  // Group dimensions by category for better organization
  const groupedDimensions: { [category: string]: DataDimension[] } = {};

  unselectedDimensions.forEach(dimension => {
    const category = dimension.category;
    if (!groupedDimensions[category]) {
      groupedDimensions[category] = [];
    }
    groupedDimensions[category].push(dimension);
  });

  // Check if we've reached the max number of selections
  const canAddMore = selectedDimensions.length < maxSelections;

  return (
    <div className="dimension-selector">
      <div className="selected-dimensions">
        <h3>Selected Dimensions</h3>
        {selectedDimensions.length === 0 ? (
          <p className="empty-message">No dimensions selected. Select up to {maxSelections} dimensions to visualize.</p>
        ) : (
          <ul className="dimension-list">
            {selectedDimensions.map(dimension => (
              <li key={dimension.id} className="dimension-item selected">
                <span className="dimension-name">{dimension.name}</span>
                <span className="dimension-type">{dimension.dataType}</span>
                <button
                  className="remove-dimension"
                  onClick={() => onRemoveDimension(dimension)}
                  aria-label={`Remove ${dimension.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="available-dimensions">
        <h3>Available Dimensions</h3>
        {Object.entries(groupedDimensions).map(([category, dimensions]) => (
          <div key={category} className="dimension-category">
            <h4>{category}</h4>
            <ul className="dimension-list">
              {dimensions.map(dimension => (
                <li key={dimension.id} className="dimension-item">
                  <span className="dimension-name">{dimension.name}</span>
                  <span className="dimension-type">{dimension.dataType}</span>
                  <button
                    className="add-dimension"
                    onClick={() => onSelectDimension(dimension)}
                    disabled={!canAddMore}
                    aria-label={`Add ${dimension.name}`}
                  >
                    +
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DimensionSelector;
