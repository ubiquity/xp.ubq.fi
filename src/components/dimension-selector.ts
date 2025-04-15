import type { DataDimension } from '../types/data-types';

interface DimensionSelectorProps {
  availableDimensions: DataDimension[];
  selectedDimensions: DataDimension[];
  onSelectDimension: (dimension: DataDimension) => void;
  onRemoveDimension: (dimension: DataDimension) => void;
  maxSelections?: number;
}

/**
 * Renders the dimension selector UI into a container element.
 * @param container - The HTMLElement to render the selector into.
 * @param props - The properties for the dimension selector.
 */
export function renderDimensionSelector(container: HTMLElement, props: DimensionSelectorProps): void {
  const {
    availableDimensions,
    selectedDimensions,
    onSelectDimension,
    onRemoveDimension,
    maxSelections = 3
  } = props;

  // Clear previous content
  container.innerHTML = '';

  // Create root element
  const selectorDiv = document.createElement('div');
  selectorDiv.className = 'dimension-selector';

  // --- Selected Dimensions Section ---
  const selectedDiv = document.createElement('div');
  selectedDiv.className = 'selected-dimensions';

  const selectedH3 = document.createElement('h3');
  selectedH3.textContent = 'Selected Dimensions';
  selectedDiv.appendChild(selectedH3);

  if (selectedDimensions.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-message';
    emptyMsg.textContent = `No dimensions selected. Select up to ${maxSelections} dimensions to visualize.`;
    selectedDiv.appendChild(emptyMsg);
  } else {
    const selectedUl = document.createElement('ul');
    selectedUl.className = 'dimension-list';
    selectedDimensions.forEach(dimension => {
      const li = document.createElement('li');
      li.className = 'dimension-item selected';
      li.dataset.id = dimension.id; // Use data-* for potential identification

      const nameSpan = document.createElement('span');
      nameSpan.className = 'dimension-name';
      nameSpan.textContent = dimension.name;
      li.appendChild(nameSpan);

      const typeSpan = document.createElement('span');
      typeSpan.className = 'dimension-type';
      typeSpan.textContent = dimension.dataType;
      li.appendChild(typeSpan);

      const removeButton = document.createElement('button');
      removeButton.className = 'remove-dimension';
      removeButton.textContent = '✕';
      removeButton.setAttribute('aria-label', `Remove ${dimension.name}`);
      removeButton.addEventListener('click', () => onRemoveDimension(dimension));
      li.appendChild(removeButton);

      selectedUl.appendChild(li);
    });
    selectedDiv.appendChild(selectedUl);
  }
  selectorDiv.appendChild(selectedDiv);

  // --- Available Dimensions Section ---
  const availableDiv = document.createElement('div');
  availableDiv.className = 'available-dimensions';

  const availableH3 = document.createElement('h3');
  availableH3.textContent = 'Available Dimensions';
  availableDiv.appendChild(availableH3);

  // Filter and group dimensions
  const unselectedDimensions = availableDimensions.filter(
    dim => !selectedDimensions.some(selected => selected.id === dim.id)
  );
  const groupedDimensions: { [category: string]: DataDimension[] } = {};
  unselectedDimensions.forEach(dimension => {
    const category = dimension.category;
    if (!groupedDimensions[category]) {
      groupedDimensions[category] = [];
    }
    groupedDimensions[category].push(dimension);
  });

  const canAddMore = selectedDimensions.length < maxSelections;

  Object.entries(groupedDimensions).forEach(([category, dimensions]) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'dimension-category';

    const categoryH4 = document.createElement('h4');
    categoryH4.textContent = category;
    categoryDiv.appendChild(categoryH4);

    const availableUl = document.createElement('ul');
    availableUl.className = 'dimension-list';
    dimensions.forEach(dimension => {
      const li = document.createElement('li');
      li.className = 'dimension-item';
      li.dataset.id = dimension.id;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'dimension-name';
      nameSpan.textContent = dimension.name;
      li.appendChild(nameSpan);

      const typeSpan = document.createElement('span');
      typeSpan.className = 'dimension-type';
      typeSpan.textContent = dimension.dataType;
      li.appendChild(typeSpan);

      const addButton = document.createElement('button');
      addButton.className = 'add-dimension';
      addButton.textContent = '+';
      addButton.disabled = !canAddMore;
      addButton.setAttribute('aria-label', `Add ${dimension.name}`);
      addButton.addEventListener('click', () => onSelectDimension(dimension));
      li.appendChild(addButton);

      availableUl.appendChild(li);
    });
    categoryDiv.appendChild(availableUl);
    availableDiv.appendChild(categoryDiv);
  });
  selectorDiv.appendChild(availableDiv);

  // Append the whole selector to the container
  container.appendChild(selectorDiv);
}
