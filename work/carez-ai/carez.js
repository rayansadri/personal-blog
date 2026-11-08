(() => {
  const examples = {
    MRI: ['Sequence, orientation, and consistent image dimensions.', 'An example segmentation workflow with paired masks.', 'Review image–mask alignment and agreed dataset requirements.'],
    CT: ['Slice spacing, volume organization, and consistent file structure.', 'An example volume-based research workflow.', 'Review volume completeness and the agreed data specification.'],
    'X-ray': ['View position, image dimensions, and label consistency.', 'An example image classification workflow.', 'Review label coverage and the agreed evaluation split.']
  };
  const fields = ['characteristics', 'task', 'validation'];
  document.querySelectorAll('[data-modality]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-modality]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      examples[button.dataset.modality].forEach((text, i) => { document.getElementById(fields[i]).textContent = text; });
    });
  });
})();
