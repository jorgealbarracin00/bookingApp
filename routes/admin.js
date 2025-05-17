document.addEventListener('DOMContentLoaded', function() {
  const deleteForms = document.querySelectorAll('form[action="/admin/delete-slot"]');
  deleteForms.forEach(form => {
    form.addEventListener('submit', function () {
      const td = form.closest('td');
      const date = form.querySelector('input[name="date"]').value;
      const time = form.querySelector('input[name="time"]').value;

      // Delay DOM update to ensure form submits
      setTimeout(() => {
        if (td) {
          td.innerHTML = `
            <button type="button" class="slot-toggle" data-date="${date}" data-time="${time}" style="width: 100%; padding: 6px; border: none; border-radius: 4px; background-color: #f44336; color: white;" data-status="unavailable">Unavailable</button>
            <input type="hidden" name="slots_${date}_${time}" value="unavailable">
          `;

          const newButton = td.querySelector('.slot-toggle');
          const hiddenInput = td.querySelector('input[type="hidden"]');
          if (newButton && hiddenInput) {
            newButton.addEventListener('click', () => {
              const newStatus = newButton.dataset.status === 'available' ? 'unavailable' : 'available';
              newButton.style.backgroundColor = newStatus === 'available' ? '#4CAF50' : '#f44336';
              newButton.textContent = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
              newButton.dataset.status = newStatus;
              hiddenInput.value = newStatus;
            });
          }
        }
      }, 500);
    });
  });
});