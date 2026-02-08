// Mobile Menu Toggle Script
document.addEventListener('DOMContentLoaded', function() {
  const navButton = document.querySelector('.greedy-nav button');
  const visibleLinks = document.querySelector('.visible-links');
  const hiddenLinks = document.querySelector('.hidden-links');
  const nav = document.querySelector('.greedy-nav');

  // Ensure visible links are shown on large screens
  function ensureCorrectDisplay() {
    const windowWidth = window.innerWidth;
    if (windowWidth > 900 && visibleLinks) {
      visibleLinks.style.display = 'flex';
      visibleLinks.style.visibility = 'visible';
      visibleLinks.style.opacity = '1';
    }
  }

  // Ensure hidden menu starts hidden
  if (hiddenLinks && !hiddenLinks.classList.contains('hidden')) {
    hiddenLinks.classList.add('hidden');
  }

  // Initial check
  ensureCorrectDisplay();

  if (navButton && hiddenLinks) {
    navButton.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();

      // Toggle hidden class on hidden-links
      if (hiddenLinks.classList.contains('hidden')) {
        hiddenLinks.classList.remove('hidden');
        navButton.classList.add('close');
        console.log('Menu opened'); // Debug log
      } else {
        hiddenLinks.classList.add('hidden');
        navButton.classList.remove('close');
        console.log('Menu closed'); // Debug log
      }
    });
  }

  // Handle responsive menu - move all items to hidden menu on small screens
  function populateHiddenMenu() {
    if (!visibleLinks || !hiddenLinks) return;

    const windowWidth = window.innerWidth;

    // Only populate hidden menu on small screens (breakpoint at 900px)
    if (windowWidth <= 900) {
      // Clear hidden links first
      hiddenLinks.innerHTML = '';

      // Clone all visible links to hidden menu
      const allLinks = visibleLinks.querySelectorAll('li');
      allLinks.forEach((link) => {
        const clone = link.cloneNode(true);
        hiddenLinks.appendChild(clone);
      });
    } else {
      // Clear hidden menu on larger screens
      hiddenLinks.innerHTML = '';
      // Ensure visible links are shown
      visibleLinks.style.display = 'flex';
      visibleLinks.style.visibility = 'visible';
      visibleLinks.style.opacity = '1';
    }
  }

  // Run on load and resize
  populateHiddenMenu();
  window.addEventListener('resize', function() {
    populateHiddenMenu();
    ensureCorrectDisplay();
  });

  // Close menu when clicking outside
  document.addEventListener('click', function(event) {
    if (nav && !nav.contains(event.target)) {
      if (hiddenLinks) {
        hiddenLinks.classList.add('hidden');
      }
      if (navButton) {
        navButton.classList.remove('close');
      }
    }
  });
});
