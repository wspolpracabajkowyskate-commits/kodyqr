(() => {
  const historySection = document.querySelector('#historia');
  if (!historySection || document.querySelector('#jak-dziala')) return;
  const section = document.createElement('section');
  section.className = 'qr-story';
  section.id = 'jak-dziala';
  section.innerHTML = `
    <div class="qr-story-inner">
      <header class="qr-story-head">
        <p class="eyebrow">PROSTO. BEZ UKRYTYCH ZASAD.</p>
        <h2>Jeden kod.<br>Bez zbędnych pośredników.</h2>
        <p>Tworzysz kod bezpośrednio z adresu, który podajesz. Pobierasz plik i możesz umieścić go na wizytówce, plakacie, opakowaniu lub w swoim lokalu.</p>
      </header>
      <div class="qr-feature-grid">
        <article class="qr-feature"><div class="qr-feature-icon" aria-hidden="true">↗</div><h3>Bez przekierowań</h3><p>Adres docelowy jest zapisany w samym kodzie QR. Nie korzystamy z własnego skracacza ani pośredniej strony przekierowującej.</p></article>
        <article class="qr-feature"><div class="qr-feature-icon" aria-hidden="true">∞</div><h3>Bez abonamentu</h3><p>Nie ma konta do opłacania ani limitu skanowań po stronie tego generatora. Kod pobierasz i używasz samodzielnie.</p></article>
        <article class="qr-feature"><div class="qr-feature-icon" aria-hidden="true">⌁</div><h3>Gotowy do druku</h3><p>Pobierz PNG, JPG lub SVG. Wybierz większy rozmiar do druku albo plik wektorowy, który łatwo skalować.</p></article>
      </div>
      <div class="qr-faq">
        <h2>Warto wiedzieć</h2>
        <details><summary>Czy kod QR naprawdę nie wygasa?</summary><p>Sam statyczny kod QR nie ma daty ważności i nie wymaga naszego serwera. Będzie działał tak długo, jak urządzenie odczyta kod, a zapisany w nim adres nadal będzie aktywny. Jeśli zmieni się lub wygaśnie strona docelowa, kod nadal zeskanuje się poprawnie, ale nie otworzy już właściwej treści.</p></details>
        <details><summary>Czy mogę zmienić adres po wydrukowaniu kodu?</summary><p>Nie. W statycznym kodzie adres jest zapisany bezpośrednio w jego strukturze. Po zmianie adresu trzeba wygenerować i wydrukować nowy kod. To właśnie brak zewnętrznego przekierowania sprawia, że nie zależy on od abonamentu dostawcy dynamicznych kodów.</p></details>
        <details><summary>Czy historia kodów jest dostępna na każdym urządzeniu?</summary><p>Nie. Historia jest zapisywana lokalnie w pamięci tej przeglądarki. Nie wysyłamy jej na serwer, więc nie synchronizuje się automatycznie między telefonem, komputerem i innymi przeglądarkami.</p></details>
        <details><summary>Jaki format wybrać do druku?</summary><p>Najczęściej wybierz SVG — to grafika wektorowa, którą można skalować bez utraty ostrości. PNG 2400 px też sprawdzi się w wielu projektach drukowanych. Przed produkcją zawsze zeskanuj próbny wydruk z docelowej odległości.</p></details>
      </div>
      <div class="qr-story-cta"><a href="#top">Wygeneruj swój kod QR ↑</a></div>
    </div>`;
  historySection.parentNode.insertBefore(section, historySection);
  const card = document.querySelector('.card');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (card && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    card.addEventListener('pointermove', event => {
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width;
      const y = (event.clientY - r.top) / r.height;
      card.style.transform = `perspective(1100px) rotateX(${(0.5-y)*2.2}deg) rotateY(${(x-0.5)*2.8}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
})();