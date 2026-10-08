(() => {
  'use strict';

  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  const dialogs = { manifesto: document.querySelector('#manifesto-dialog'), briefing: document.querySelector('#briefing-dialog') };
  const form = document.querySelector('#briefing-form');
  const result = document.querySelector('#briefing-result');
  const downloadLink = document.querySelector('#briefing-download');
  let downloadUrl;
  let dialogTrigger;

  function closeMenu() {
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
  }

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    mobileNav.hidden = isOpen;
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Abrir menu' : 'Fechar menu');
  });

  mobileNav.querySelectorAll('a, button').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('click', (event) => {
    if (!mobileNav.hidden && !event.target.closest('.site-header')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });

  document.querySelectorAll('[data-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = dialogs[button.dataset.open];
      if (!dialog) return;
      // Keep the original page trigger when switching between dialogs.
      if (!button.closest('dialog')) dialogTrigger = button.closest('.mobile-nav') ? menuButton : button;
      Object.values(dialogs).forEach((other) => { if (other.open) other.close(); });
      dialog.showModal();
      dialog.scrollTop = 0;
      document.body.classList.add('modal-open');
    });
  });

  Object.values(dialogs).forEach((dialog) => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!Object.values(dialogs).some((item) => item.open)) {
        document.body.classList.remove('modal-open');
        dialogTrigger?.focus({ preventScroll: true });
      }
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const nameField = form.elements.namedItem('name');
    const ideaField = form.elements.namedItem('idea');
    nameField.value = nameField.value.trim();
    ideaField.value = ideaField.value.trim();
    nameField.setCustomValidity(nameField.value ? '' : 'Informe seu nome para continuar.');
    ideaField.setCustomValidity(ideaField.value.length >= 10 ? '' : 'Conte sua ideia em pelo menos 10 caracteres.');
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const brief = [
      'CODE3VISION — BRIEFING DO PROJETO',
      'Sua visão. Em outra dimensão.',
      '',
      `Nome: ${String(values.get('name')).trim()}`,
      `E-mail: ${String(values.get('email')).trim()}`,
      `Interesse: ${values.get('service')}`,
      '',
      'A IDEIA',
      String(values.get('idea')).trim(),
      '',
      `Criado em ${new Date().toLocaleDateString('pt-BR')}.`,
      'Este briefing foi preparado localmente. Nenhuma mensagem foi enviada.',
      '',
    ].join('\r\n');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob(['\uFEFF', brief], { type: 'text/plain;charset=utf-8' }));
    downloadLink.href = downloadUrl;
    form.hidden = true;
    result.hidden = false;
    downloadLink.focus();
  });

  ['name', 'idea'].forEach((field) => {
    form.elements.namedItem(field).addEventListener('input', (event) => event.target.setCustomValidity(''));
  });

  document.querySelector('#edit-briefing').addEventListener('click', () => {
    form.hidden = false;
    result.hidden = true;
    form.elements.name.focus();
  });

  const motionButton = document.querySelector('#motion-toggle');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motionPreference.matches;
  function updateMotion() {
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Reproduzir animação' : 'Pausar animação');
    window.code3visionArt?.setPaused(paused);
  }
  motionButton.addEventListener('click', () => { paused = !paused; updateMotion(); });
  motionPreference.addEventListener('change', (event) => { paused = event.matches; updateMotion(); });
  updateMotion();
  document.querySelector('#year').textContent = String(new Date().getFullYear());
  window.addEventListener('pagehide', (event) => {
    if (downloadUrl && !event.persisted) URL.revokeObjectURL(downloadUrl);
  });
})();
