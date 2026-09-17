(function(){
  var header = document.getElementById('siteHeader');
  var onScroll = function(){
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var toggle = document.getElementById('navToggle');
  toggle.addEventListener('click', function(){
    var open = header.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.getElementById('mobilePanel').querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      header.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('is-visible'); });
  }

  var form = document.getElementById('requestForm');
  var status = document.getElementById('formStatus');
  if (form && status) {
    form.addEventListener('submit', function(e){
      e.preventDefault();
      status.classList.add('is-visible');
      form.reset();
    });
  }

  var videoModal = document.getElementById('heroVideoModal');
  if (videoModal) {
    var openVideoModal = function(){
      videoModal.classList.add('is-open');
      videoModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
    var closeVideoModal = function(){
      videoModal.classList.remove('is-open');
      videoModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    document.querySelectorAll('[data-video-open]').forEach(function(btn){
      btn.addEventListener('click', openVideoModal);
    });
    videoModal.querySelectorAll('[data-video-close]').forEach(function(el){
      el.addEventListener('click', closeVideoModal);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && videoModal.classList.contains('is-open')) closeVideoModal();
    });
  }

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Eased wheel scrolling, on request ("если быстро пролистнуть сайт он
  // может сразу на последний блок перелететь... плавное прокручивание").
  // Scroll-linked effects (the header's is-scrolled class above, the work
  // section's parallax further down, the reveal-on-scroll fades) all read
  // window.scrollY / getBoundingClientRect purely as a function of the
  // CURRENT scroll position — they have no memory of how it got there, so
  // a single huge native jump (a hard trackpad fling, or a mouse with a
  // very sensitive wheel) makes them snap straight to their end state
  // instead of animating through it. The fix has to slow down the actual
  // scroll position itself, not any individual effect.
  //
  // This intercepts wheel input and, instead of letting the browser jump
  // scrollTop immediately, feeds the delta into a target position that a
  // rAF loop eases the real window scroll toward (exponential decay,
  // frame-rate independent via elapsed dt). Because it still drives the
  // browser's actual scrollTop via window.scrollTo every frame — not a
  // transform-based fake scroll container — every existing scroll listener
  // above and below keeps firing exactly as it already does; nothing else
  // had to change to benefit from this.
  //
  // Deliberately wheel-only: keyboard scrolling (PageDown/Space/arrows),
  // scrollbar-thumb dragging, and touch scrolling are left completely
  // native (skipped for coarse/no-hover pointers below), so this can only
  // smooth out exactly the interaction it was reported for.
  if (finePointer && !reduceMotion) {
    var ssTarget = window.scrollY;
    var ssCurrent = window.scrollY;
    var ssRunning = false;
    var ssLastT = 0;

    var ssMax = function(){
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    };

    var ssStep = function(t){
      if (!ssLastT) ssLastT = t;
      var dt = Math.min(48, t - ssLastT) / 1000; // clamp so a background tab / dropped frame can't lurch
      ssLastT = t;

      var max = ssMax();
      if (ssTarget > max) ssTarget = max;
      var amount = 1 - Math.exp(-2.75 * dt);
      ssCurrent += (ssTarget - ssCurrent) * amount;

      if (Math.abs(ssTarget - ssCurrent) < 0.5) {
        ssCurrent = ssTarget;
        window.scrollTo({ top: ssCurrent, left: 0, behavior: 'instant' });
        ssRunning = false;
        ssLastT = 0;
        return;
      }
      // behavior:'instant' is required here -- html{scroll-behavior:smooth}
      // (for the no-JS/progressive-enhancement fallback) applies to EVERY
      // programmatic scrollTo by default, so a plain scrollTo(0, ssCurrent)
      // each frame would make the browser launch its OWN ~300ms smooth
      // animation toward that position on top of this rAF loop's -- next
      // frame arrives ~16ms later and redirects that still-in-flight native
      // animation to a new position before it can finish, over and over.
      // The two competing animations fight each other into a stuttering,
      // massively lagging crawl instead of the intended single smooth
      // motion (confirmed via instrumentation: without this, a target 6000px
      // away was still only ~45% covered after a full second).
      window.scrollTo({ top: ssCurrent, left: 0, behavior: 'instant' });
      requestAnimationFrame(ssStep);
    };

    var ssStart = function(){
      if (ssRunning) return;
      ssRunning = true;
      ssLastT = 0;
      requestAnimationFrame(ssStep);
    };

    window.addEventListener('wheel', function(e){
      // Pinch-zoom sends wheel+ctrlKey; leave that untouched.
      if (e.ctrlKey) return;
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;        // line mode -> px
      else if (e.deltaMode === 2) delta *= window.innerHeight; // page mode -> px
      e.preventDefault();

      if (!ssRunning) {
        // A keyboard/scrollbar/touch scroll (or the very first wheel tick)
        // may have moved the page while this loop was idle -- resync
        // before layering the new delta on top, or the page would jump
        // back to a stale target the instant the wheel is touched again.
        ssCurrent = window.scrollY;
        ssTarget = window.scrollY;
      }
      ssTarget = Math.max(0, Math.min(ssMax(), ssTarget + delta));
      ssStart();
    }, { passive: false });

    // In-page nav links (header, footer, hero CTA) route through the same
    // eased target instead of the browser's own instant/native anchor
    // jump, so a header/footer click settles exactly as smoothly as a
    // wheel-driven scroll to that same section.
    document.querySelectorAll('a[href^="#"]').forEach(function(link){
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      link.addEventListener('click', function(e){
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        var headerOffset = 84; // matches section{scroll-margin-top:84px} in styles.css
        var destY = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        ssCurrent = window.scrollY;
        ssTarget = Math.max(0, Math.min(ssMax(), destY));
        ssStart();
        if (history.pushState) history.pushState(null, '', '#' + id);
      });
    });
  }

  // Delivery "fan" cards — Chromium (and other engines) will happily paint
  // 3D-rotated children (rotateY inside a preserve-3d row) but its pointer
  // hit-testing for :hover / event.target stops at the flat container that
  // establishes the 3D context, never drilling into the tilted child. So
  // :hover on .fan-card never matches in practice. Work around it by doing
  // the hit-test ourselves with elementsFromPoint (which IS 3D-aware) and
  // toggling a class by hand.
  var fanStage = document.querySelector('.fan-stage');
  if (fanStage && finePointer) {
    var activeFanCard = null;
    var setActiveFanCard = function(card){
      if (card === activeFanCard) return;
      if (activeFanCard) activeFanCard.classList.remove('is-hovered');
      if (card) card.classList.add('is-hovered');
      activeFanCard = card;
    };
    fanStage.addEventListener('mousemove', function(e){
      var stack = document.elementsFromPoint(e.clientX, e.clientY);
      var found = null;
      for (var i = 0; i < stack.length; i++){
        if (stack[i].classList && stack[i].classList.contains('fan-card')) { found = stack[i]; break; }
      }
      setActiveFanCard(found);
    });
    fanStage.addEventListener('mouseleave', function(){ setActiveFanCard(null); });
  }

  // Count-up numbers — every ".stat-num" reads "150+" / "99%" / "7+" etc.;
  // parse the leading integer and animate it up from 0 once it scrolls in.
  // Slowed down on request ("пролетают быстро что даже не понятно") and
  // now re-plays every time the block scrolls back into view instead of
  // only once ever ("если скрол ушёл на 2 блок и потом возвращается на
  // первый, чтобы они заново считались") — applies on both index.html and
  // about.html since both load this same script.js.
  var statNums = document.querySelectorAll('.stat-num');
  if (statNums.length) {
    var animateCount = function(el){
      var match = el.textContent.trim().match(/^(\d+)(.*)$/);
      if (!match) return;
      var target = parseInt(match[1], 10);
      var suffix = match[2] || '';
      if (reduceMotion) { el.textContent = target + suffix; return; }
      // A re-trigger while a previous run is still mid-flight would leave
      // two rAF loops both writing el.textContent, racing/flickering — tag
      // each run with an incrementing id and have a step bail out the
      // instant a newer run has superseded it.
      var runId = (el.__countRun = (el.__countRun || 0) + 1);
      var start = null;
      var duration = 1000;
      var step = function(ts){
        if (el.__countRun !== runId) return;
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / duration);
        // Linear, not eased -- cubic ease-out front-loads almost all of its
        // change into roughly the first half of the duration, so a SMALL
        // target (7, 6, 4...) already rounds to its final integer well
        // before the animation technically ends and then just sits idle
        // (measured: reached "7+" at ~1.4s into a 2.8s run) -- the exact
        // "пролетает быстро" complaint this duration bump was meant to fix.
        // Linear spreads each integer step evenly across the full
        // duration instead, so it keeps visibly changing the whole time.
        var eased = p;
        el.textContent = Math.round(eased * target) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
      var countIo = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if (entry.isIntersecting) animateCount(entry.target);
        });
      }, { threshold: 0.6 });
      statNums.forEach(function(el){ countIo.observe(el); });
    } else {
      statNums.forEach(animateCount);
    }
  }

  // Services photo cards — the img is top-anchored and 138% tall (see
  // .work-card__media in CSS), all overshoot hanging below the frame, so
  // it only ever needs to slide UP as the card crosses the viewport
  // (never down — that would open a gap at the top and/or crop the
  // caption text baked into the top of every photo). y=0 exactly when the
  // card sits centred in the viewport, so a generous range is safe — it
  // only gets used up near the top/bottom edge of the viewport, not while
  // the card is actually being read.
  var workImgs = document.querySelectorAll('.work-card__media img');
  if (workImgs.length && !reduceMotion) {
    var updateWorkParallax = function(){
      var vh = window.innerHeight;
      workImgs.forEach(function(img){
        var r = img.parentElement.getBoundingClientRect();
        var center = r.top + r.height / 2;
        var progress = (center - vh / 2) / vh;
        var range = r.height * 0.16;
        var y = -Math.min(range, Math.abs(progress) * range * 1.7);
        img.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      });
    };
    updateWorkParallax();
    window.addEventListener('scroll', function(){ requestAnimationFrame(updateWorkParallax); }, { passive: true });
    window.addEventListener('resize', updateWorkParallax);
  }

  // Process "conveyor" — a real 3D carousel (perspective + rotateY +
  // translateZ, not a flat translateX/opacity slide): 8 step cards
  // auto-cycle on a timer, one rotating to face the camera at a time
  // while the rest tilt away and recede in both directions. It's a
  // looping belt, not a one-shot slider — distance-from-active wraps
  // around the 8 cards both ways (see the diff normalisation below) so
  // nothing "snaps back" at the ends, it just keeps orbiting through
  // the centre. Only promoted into that live 3D stack when the viewport
  // is wide enough AND motion is allowed — .conveyor has no .is-live
  // otherwise, and its CSS falls back to a plain responsive grid that
  // needs no JS at all, so narrow/reduced-motion visitors still get
  // every step's text, just laid out flat (no perspective, no rotation).
  var conveyor = document.querySelector('[data-conveyor]');
  if (conveyor && !reduceMotion && window.matchMedia('(min-width: 760px)').matches) {
    var cViewport = conveyor.querySelector('.conveyor__cards');
    var cCards = Array.prototype.slice.call(conveyor.querySelectorAll('.conveyor-card'));
    var cDots = conveyor.querySelectorAll('.conveyor__dots button');
    var cPrev = conveyor.querySelector('[data-conveyor-prev]');
    var cNext = conveyor.querySelector('[data-conveyor-next]');
    var n = cCards.length;
    var active = 0;
    // Offset table: {x: translateX px, z: translateZ px, ry: rotateY deg,
    // scale, opacity} per distance-from-active. Sign of x/ry flips per
    // side (mirrored) in layoutConveyor. 5 cards are visible in frame
    // (active + 2 either side), but offset 1's geometry is untouched
    // from the 3-up layout — offset 2 is pushed well past it (further
    // out, further back, smaller, dimmer) purely as a receding
    // background pair, not a size step down from offset 1. Everything
    // beyond distance 2 reuses offset 2's geometry with opacity forced
    // to 0, so it fades in already in place rather than popping from
    // nowhere once it becomes the visible offset-2 card.
    // op stays 1 for every visible card — cards are meant to read as solid
    // opaque boxes, not glass. Below-1 opacity here used to fade side/
    // background cards for a depth cue, but on a preserve-3d card whose
    // edge is rotated close to face-on toward the camera, sub-1 opacity
    // also visibly let OTHER faces/edges show through the translucent
    // ones ("не нужно чтобы карточка просвечивала"). Scale + the edges'
    // own darkening gradient now carry the whole "recedes into the
    // background" cue instead. Only the fully offscreen (abs>2) tier
    // still forces op to 0 below — that's a hard hide, not a fade.
    // depth: each tier also gets its own --depth (rib thickness), NOT
    // just the CSS default (18px) — a rib's PROJECTED screen width is
    // driven by both physical depth and how face-on its rotateY is, so
    // offset 2's steeper 48deg reveals more of the same 18px than offset
    // 1's 32deg does (measured: ~14.6px on screen vs ~12.2px at an equal
    // 18px depth). First pass matched them (offset 2 at 15px depth ==
    // offset 1's ~12.2px on screen); on request offset 2 was then made
    // thinner still than offset 1 (10px physical → ~8.1px on screen),
    // then thinner again to 6px physical → ~4.9px on screen (offset 1
    // stays ~12.2px throughout). This is keyed to DISTANCE from the active card
    // (OFFSET[2], abs===2), not to which card index is showing — every
    // card cycles through both tiers as it moves through the belt, so
    // whichever card currently sits 2 slots out always gets the thinner
    // rib, automatically. Re-measure and adjust if OFFSET[1].ry,
    // OFFSET[2].ry, or the base --depth change.
    // op: a "further away, harder to see" cue for the far/background
    // tier (offset 2) — the near tier (offset 1) and active card stay
    // fully opaque. Set on the LEAF elements (.card-face, each
    // .card-edge-*) in CSS, never on .conveyor-card itself — opacity on
    // the preserve-3d parent is what collapsed the ribs to zero width
    // (see the big comment on .card-face in styles.css); this reads
    // exactly the same custom property, just consumed one level down.
    var OFFSET = {
      1: { x: 430, z: -160, ry: 32, sc: .86, op: 1, depth: 18 },
      2: { x: 760, z: -420, ry: 48, sc: .58, op: .5, depth: 6 }
    };
    // Each tick every card travels a different pixel distance (a full
    // 0->1 step covers ~330px, a 2->3 step only ~255px, and a card
    // fading in/out at the far edge doesn't move in x/z at all) — a
    // single fixed transition-duration for all of them made the ones
    // covering more ground visibly outrun the ones covering less. Track
    // each card's previous tx/tz and scale its duration to the distance
    // it's about to cover so every card appears to move at the same
    // speed regardless of how far that particular step takes it.
    var PX_PER_SEC = 420, MIN_DUR = .5, MAX_DUR = 1.1;
    var prevPos = cCards.map(function(){ return { tx: 0, tz: 0 }; });
    var layoutConveyor = function(){
      cCards.forEach(function(card, i){
        var diff = i - active;
        if (diff > n / 2) diff -= n;
        if (diff < -n / 2) diff += n;
        var abs = Math.abs(diff);
        var sign = diff < 0 ? -1 : 1;
        var tx = 0, tz = 0, ry = 0, sc = 1, op = 1, z = n, depth = 18;
        if (abs > 0) {
          var t = OFFSET[Math.min(abs, 2)];
          tx = sign * t.x;
          tz = t.z;
          ry = sign * t.ry;
          sc = t.sc;
          op = abs > 2 ? 0 : t.op;
          z = n - abs;
          depth = t.depth;
          card.classList.remove('side-left', 'side-right');
          card.classList.add(sign > 0 ? 'side-right' : 'side-left');
        }
        // abs===0 (the active card) deliberately does NOT touch
        // side-left/side-right or --depth at all — it just keeps
        // whatever it already had from the tick before it became active.
        // ry is animating smoothly toward 0 regardless, which already
        // makes the visible rib's on-screen width shrink to nothing on
        // its own; forcing a display:none + a --depth snap in the same
        // instant was a SECOND, uncoordinated change riding on top of
        // that smooth shrink, and it's what actually read as a jitter
        // ("рамка дёргается и становится меньше") right as a card
        // crossed into the centre. Leaving both alone here means the
        // only thing animating through this transition is ry itself.
        var prev = prevPos[i];
        var dist = Math.sqrt(Math.pow(tx - prev.tx, 2) + Math.pow(tz - prev.tz, 2));
        var dur = dist === 0 ? MIN_DUR : Math.min(MAX_DUR, Math.max(MIN_DUR, dist / PX_PER_SEC));
        card.style.transitionDuration = dur.toFixed(2) + 's';
        prevPos[i] = { tx: tx, tz: tz };
        card.style.setProperty('--tx', tx + 'px');
        card.style.setProperty('--tz', tz + 'px');
        card.style.setProperty('--ry', ry + 'deg');
        card.style.setProperty('--sc', sc);
        card.style.setProperty('--op', op);
        card.style.setProperty('--z', z);
        card.style.setProperty('--depth', depth + 'px');
        card.style.pointerEvents = abs > 2 ? 'none' : 'auto';
        card.classList.toggle('is-active', abs === 0);
      });
      cDots.forEach(function(dot, i){ dot.classList.toggle('is-active', i === active); });
    };
    var conveyorTimer = null;
    var startConveyor = function(){
      conveyorTimer = setInterval(function(){ active = (active + 1) % n; layoutConveyor(); }, 4200);
    };
    var stopConveyor = function(){
      if (conveyorTimer) { clearInterval(conveyorTimer); conveyorTimer = null; }
    };
    var jumpTo = function(i){
      active = ((i % n) + n) % n;
      layoutConveyor();
      stopConveyor();
      startConveyor();
    };
    conveyor.classList.add('is-live');
    layoutConveyor();
    startConveyor();
    // Pause only for a hover on whichever card is currently the front/active
    // one — not the whole conveyor area. The timer is stopped for the
    // entire hover, so the active card can't change out from under it
    // mid-hover, meaning the same is-active check is safe on both ends.
    cCards.forEach(function(card, i){
      card.addEventListener('click', function(){ jumpTo(i); });
      card.addEventListener('mouseenter', function(){
        if (card.classList.contains('is-active')) stopConveyor();
      });
      card.addEventListener('mouseleave', function(){
        if (card.classList.contains('is-active')) startConveyor();
      });
    });
    cDots.forEach(function(dot, i){ dot.addEventListener('click', function(){ jumpTo(i); }); });
    if (cPrev) cPrev.addEventListener('click', function(){ jumpTo(active - 1); });
    if (cNext) cNext.addEventListener('click', function(){ jumpTo(active + 1); });

    // Keyboard: left/right arrows while the scene itself has focus.
    cViewport.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight') { e.preventDefault(); jumpTo(active + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); jumpTo(active - 1); }
    });

    // Touch swipe on the viewport itself (~40px threshold).
    var touchStartX = null;
    cViewport.addEventListener('touchstart', function(e){ touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    cViewport.addEventListener('touchend', function(e){
      if (touchStartX === null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 40) return;
      jumpTo(dx < 0 ? active + 1 : active - 1);
    }, { passive: true });
  }

  // Reviews-page hero carousel — one testimonial card visible at a time
  // (2 more fanned out behind it), prev/next + dot navigation + an
  // "n / total" counter, on request ("в референсе для страницы Отзывы...
  // можешь сделать то же самое?").
  var reviewsCarousel = document.querySelector('[data-reviews-carousel]');
  if (reviewsCarousel) {
    // 9 more placeholder testimonials on top of the 3 real ones already in
    // the HTML, on request ("сделай ещё 9 карточек... чтобы было 12").
    // Built from a data array + template function instead of hand-writing
    // 9 more near-identical HTML blocks, so a future edit (swapping in the
    // real photos "дам позже") only touches this list, not markup. Avatars
    // are initials, same placeholder convention as the first 3 and the
    // avatar stack — not invented stock photos standing in for real named
    // clients.
    var EXTRA_REVIEWS = [
      { photo:'review-igor.jpg', name:'Игорь Петров', role:'Автозапчасти', text:'Заказываем автозапчасти из Гуанчжоу и Иу уже больше года. «Дракон Трейд» всегда точно считает сроки и стоимость — никаких сюрпризов на таможне.', category:'Автозапчасти' },
      { photo:'review-elena.jpg', name:'Елена Кузнецова', role:'Мебель и товары для дома', text:'Везём мебельную фурнитуру и текстиль для дома. Понравилось, что можно объединять грузы от разных поставщиков в одну партию — экономим на логистике.', category:'Мебель' },
      { photo:'review-timur.jpg', name:'Тимур Юсупов', role:'Стройматериалы', text:'Крупногабаритный груз, нестандартная упаковка — всё равно довезли без повреждений и в заявленный срок. Рекомендую тем, кто возит стройматериалы.', category:'Стройматериалы' },
      { photo:'review-olga.jpg', name:'Ольга Никитина', role:'Косметика', text:'Помогли оформить сертификаты на косметику и провести маркировку «Честный знак» без задержек. Для нашей ниши это критично, спасибо команде.', category:'Косметика' },
      { photo:'review-sergey.jpg', name:'Сергей Морозов', role:'Электроника', text:'Возим электронику мелкими партиями каждые две недели. Ни разу не терялся груз, менеджер всегда на связи и присылает фото при отгрузке.', category:'Электроника' },
      { photo:'review-anna.jpg', name:'Анна Белова', role:'Игрушки', text:'Первая поставка была тестовой, теперь возим регулярно. Понравилась прозрачность — видно каждый этап от склада в Китае до нашего города.', category:'Игрушки' },
      { photo:'review-dmitry.jpg', name:'Дмитрий Ковалёв', role:'Упаковка', text:'Работаем с наливными и сыпучими материалами — требования к таре жёсткие. «Дракон Трейд» подобрал правильную упаковку и довёз без потерь.', category:'Упаковка' },
      { photo:'review-viktoria.jpg', name:'Виктория Орлова', role:'Обувь', text:'Возим обувь из Гуанчжоу три года, сначала с другим подрядчиком были постоянные проблемы с таможней. С «Дракон Трейд» всё стало предсказуемо.', category:'Обувь' },
      { photo:'review-maxim.jpg', name:'Максим Орлов', role:'Бытовая техника', text:'Крупная партия бытовой техники пришла точно в срок, все документы были готовы заранее. Отдельно отмечу удобную отчётность по грузу.', category:'Бытовая техника' }
    ];
    var STAR_SVG = '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L10 14.9 4.4 18l1.4-6.2L1 7.5l6.4-.6Z"/></svg>';
    var QUOTE_SVG = '<svg class="reviews-card__quote" viewBox="0 0 24 24" fill="currentColor"><path d="M7 8c-2.2 0-4 1.8-4 4v4h4v-4H5c0-1.1.9-2 2-2V8Zm10 0c-2.2 0-4 1.8-4 4v4h4v-4h-2c0-1.1.9-2 2-2V8Z"/></svg>';
    var BOX_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-5 9 5-9 5-9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>';
    var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg>';
    var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';

    var stack = reviewsCarousel.querySelector('.reviews-carousel__stack');
    var nextIndex = reviewsCarousel.querySelectorAll('.reviews-card').length;
    EXTRA_REVIEWS.forEach(function(r){
      var article = document.createElement('article');
      article.className = 'reviews-card';
      article.setAttribute('data-index', nextIndex++);
      article.innerHTML =
        '<div class="reviews-card__head">' +
          '<span class="reviews-card__avatar"><img src="images/' + r.photo + '" alt="" loading="lazy"></span>' +
          '<div><strong>' + r.name + '</strong><span>' + r.role + '</span></div>' +
          QUOTE_SVG +
        '</div>' +
        '<div class="review-stars">' + STAR_SVG.repeat(5) + '</div>' +
        '<p class="review-text">' + r.text + '</p>' +
        '<div class="reviews-card__tags">' +
          '<span>' + BOX_SVG + r.category + '</span>' +
          '<span>' + PIN_SVG + 'Китай → Россия</span>' +
          '<span class="reviews-card__status">' + CHECK_SVG + 'Поставка выполнена</span>' +
        '</div>';
      stack.appendChild(article);
    });

    var rCards = Array.prototype.slice.call(reviewsCarousel.querySelectorAll('.reviews-card'));
    var rPrev = reviewsCarousel.querySelector('[data-reviews-prev]');
    var rNext = reviewsCarousel.querySelector('[data-reviews-next]');
    var rCount = reviewsCarousel.querySelector('[data-reviews-count]');
    var rDotsContainer = reviewsCarousel.querySelector('[data-reviews-dots]');
    var rTotal = rCards.length;
    var rActive = 0;

    // Dots generated from the final card count instead of hand-written in
    // HTML, so this stays correct however many .reviews-card elements end
    // up in the stack (3 real + 9 placeholder now, whatever the real count
    // is later).
    rCards.forEach(function(card, i){
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('data-index', i);
      dot.setAttribute('aria-label', 'Отзыв ' + (i + 1));
      rDotsContainer.appendChild(dot);
    });
    var rDots = rDotsContainer.querySelectorAll('button');

    var showReview = function(i){
      rActive = (i + rTotal) % rTotal;
      // data-pos = each card's distance from the active one (0 = front,
      // 1/2 = peeking behind it) — see the CSS fan-stack rules keyed off
      // this same attribute.
      rCards.forEach(function(card, idx){
        var pos = (idx - rActive + rTotal) % rTotal;
        card.setAttribute('data-pos', pos);
        card.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
      });
      rDots.forEach(function(dot, idx){ dot.classList.toggle('is-active', idx === rActive); });
      if (rCount) rCount.textContent = (rActive + 1) + ' / ' + rTotal;
    };

    if (rPrev) rPrev.addEventListener('click', function(){ showReview(rActive - 1); });
    if (rNext) rNext.addEventListener('click', function(){ showReview(rActive + 1); });
    rDots.forEach(function(dot, i){ dot.addEventListener('click', function(){ showReview(i); }); });

    showReview(0); // set the initial data-pos on every card -- without this the fan-stack CSS has nothing to key off until the first click

    // "Читать отзыв" buttons on the case cards below jump back up into the
    // carousel and land on that same client's card, instead of just
    // linking to the top of the page.
    document.querySelectorAll('[data-jump-review]').forEach(function(btn){
      btn.addEventListener('click', function(){
        showReview(parseInt(btn.getAttribute('data-jump-review'), 10));
        var top = document.getElementById('top');
        if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
})();
