(() => {
  const card = document.querySelector('.card');
  const art = document.querySelector('.hero-art');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduceMotion && finePointer && card) {
    card.addEventListener('pointermove', event => {
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width;
      const y = (event.clientY - r.top) / r.height;
      card.style.transform = `perspective(1200px) rotateX(${(0.5-y)*1.8}deg) rotateY(${(x-0.5)*2.4}deg) translateY(-2px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  }
  if (!reduceMotion && finePointer && art) {
    art.addEventListener('pointermove', event => {
      const r = art.getBoundingClientRect();
      const x = (event.clientX-r.left)/r.width-.5;
      const y = (event.clientY-r.top)/r.height-.5;
      const front = art.querySelector('.art-card-front');
      const back = art.querySelector('.art-card-back');
      if(front) front.style.transform = `rotate(9deg) translate3d(${x*9}px,${y*8}px,18px)`;
      if(back) back.style.transform = `rotate(-12deg) translate3d(${-x*7}px,${-y*6}px,-20px)`;
    });
    art.addEventListener('pointerleave', () => {
      const front=art.querySelector('.art-card-front'), back=art.querySelector('.art-card-back');
      if(front) front.style.transform='';
      if(back) back.style.transform='';
    });
  }
  document.querySelectorAll('.qr-faq details').forEach(item => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.qr-faq details[open]').forEach(other => { if(other!==item) other.open=false; });
    });
  });
})();