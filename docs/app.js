(() => {
  "use strict";

  const TOTAL = 427;
  const STORAGE_KEY = "seoul427.unlocked.v1";
  const dongs = Array.isArray(window.SEOUL_DONGS) ? window.SEOUL_DONGS : [];
  const byId = new Map(dongs.map((dong) => [dong.id, dong]));

  if (dongs.length !== TOTAL || byId.size !== TOTAL) {
    document.body.innerHTML = '<main style="padding:2rem;font:16px system-ui;color:white;background:#111;min-height:100vh">数据加载失败，请刷新页面。</main>';
    throw new Error(`Expected ${TOTAL} unique dongs, received ${dongs.length}/${byId.size}.`);
  }

  const elements = {
    card: document.querySelector("#roulette-card"),
    wheel: document.querySelector("#wheel"),
    status: document.querySelector("#status-pill"),
    kicker: document.querySelector("#result-kicker"),
    name: document.querySelector("#result-name"),
    district: document.querySelector("#result-district"),
    idleActions: document.querySelector("#idle-actions"),
    decisionActions: document.querySelector("#decision-actions"),
    completeActions: document.querySelector("#complete-actions"),
    spin: document.querySelector("#spin-button"),
    confirm: document.querySelector("#confirm-button"),
    reroll: document.querySelector("#reroll-button"),
    next: document.querySelector("#next-button"),
    unlockedCount: document.querySelector("#unlocked-count"),
    remainingCount: document.querySelector("#remaining-count"),
    percentage: document.querySelector("#percentage"),
    progressBar: document.querySelector("#progress-bar"),
    headerCount: document.querySelector("#header-count"),
    poolSize: document.querySelector("#pool-size"),
    sheet: document.querySelector("#unlocked-sheet"),
    sheetBackdrop: document.querySelector("#sheet-backdrop"),
    openList: document.querySelector("#open-list"),
    openListSecondary: document.querySelector("#open-list-secondary"),
    closeList: document.querySelector("#close-list"),
    sheetCount: document.querySelector("#sheet-count"),
    sheetPercentage: document.querySelector("#sheet-percentage"),
    list: document.querySelector("#unlocked-list"),
    clear: document.querySelector("#clear-button"),
    dialogBackdrop: document.querySelector("#dialog-backdrop"),
    cancelClear: document.querySelector("#cancel-clear"),
    confirmClear: document.querySelector("#confirm-clear"),
    toast: document.querySelector("#toast"),
  };

  let unlockedIds = readProgress();
  let current = null;
  let spinning = false;
  let cycleTimer = null;
  let wheelTurns = 0;
  let toastTimer = null;
  let lastFocus = null;

  function readProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed)].filter((id) => byId.has(id));
    } catch {
      return [];
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedIds));
  }

  function secureIndex(length) {
    if (length <= 0) return -1;
    const ceiling = Math.floor(0x100000000 / length) * length;
    const buffer = new Uint32Array(1);
    do window.crypto.getRandomValues(buffer); while (buffer[0] >= ceiling);
    return buffer[0] % length;
  }

  function secureShuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = secureIndex(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function available() {
    const unlocked = new Set(unlockedIds);
    return dongs.filter((dong) => !unlocked.has(dong.id));
  }

  function setPlace(dong, kicker = "今日目的地") {
    elements.kicker.textContent = kicker;
    elements.name.textContent = dong.name;
    elements.district.textContent = `${dong.district} · 행정동`;
  }

  function setReady() {
    current = null;
    elements.status.textContent = unlockedIds.length === TOTAL ? "COMPLETE" : "READY";
    elements.status.className = "status-pill";
    elements.kicker.textContent = unlockedIds.length === TOTAL ? "427 / 427" : "今日目的地";
    elements.name.textContent = unlockedIds.length === TOTAL ? "全部解锁" : "准备出发";
    elements.district.textContent = unlockedIds.length === TOTAL ? "你已经走完首尔全部行政洞" : "转动城市，抽一个未解锁的洞";
    elements.idleActions.hidden = unlockedIds.length === TOTAL;
    elements.decisionActions.hidden = true;
    elements.completeActions.hidden = unlockedIds.length !== TOTAL;
    if (unlockedIds.length === TOTAL) elements.next.hidden = true;
  }

  function startSpin() {
    if (spinning) return;
    const pool = available();
    if (!pool.length) {
      setReady();
      return;
    }

    const shuffledPool = secureShuffle(pool);
    const selected = shuffledPool[0];
    const previewCount = Math.min(13, Math.max(0, shuffledPool.length - 1));
    const sequence = [...shuffledPool.slice(1, previewCount + 1), selected];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    spinning = true;
    current = null;
    elements.idleActions.hidden = false;
    elements.decisionActions.hidden = true;
    elements.completeActions.hidden = true;
    elements.spin.disabled = true;
    elements.status.textContent = "DRAWING";
    elements.status.className = "status-pill is-live";
    elements.kicker.textContent = `正在洗牌 · ${pool.length} 个候选`;
    elements.card.classList.remove("is-spinning");
    void elements.card.offsetWidth;
    elements.card.classList.add("is-spinning");
    wheelTurns += 1440 + secureIndex(720);
    elements.wheel.style.transform = `rotate(${wheelTurns}deg)`;

    function finishSpin() {
      current = selected;
      setPlace(current, `今日目的地 · ${pool.length} 选 1`);
      elements.card.classList.remove("is-spinning");
      elements.status.textContent = "SELECTED";
      elements.status.className = "status-pill is-live";
      elements.idleActions.hidden = true;
      elements.decisionActions.hidden = false;
      elements.spin.disabled = false;
      spinning = false;
      elements.confirm.focus({ preventScroll: true });
    }

    if (reducedMotion) {
      cycleTimer = window.setTimeout(finishSpin, 120);
      return;
    }

    let step = 0;
    function revealNext() {
      const isFinal = step === sequence.length - 1;
      if (isFinal) {
        finishSpin();
        return;
      }

      setPlace(sequence[step], `洗牌中 · ${step + 1}/${sequence.length}`);
      const progress = step / Math.max(1, sequence.length - 1);
      const delay = 55 + Math.round(progress * progress * 210);
      step += 1;
      cycleTimer = window.setTimeout(revealNext, delay);
    }

    revealNext();
  }

  function confirmSelection() {
    if (!current || spinning) return;
    if (!unlockedIds.includes(current.id)) {
      unlockedIds.push(current.id);
      saveProgress();
    }
    setPlace(current, "已加入拍摄清单");
    elements.status.textContent = "UNLOCKED";
    elements.status.className = "status-pill is-done";
    elements.idleActions.hidden = true;
    elements.decisionActions.hidden = true;
    elements.completeActions.hidden = false;
    elements.next.hidden = false;
    renderProgress();
    showToast(`${current.district} · ${current.name} 已解锁`);
  }

  function reroll() {
    current = null;
    startSpin();
  }

  function renderProgress() {
    const count = unlockedIds.length;
    const percent = (count / TOTAL) * 100;
    const percentage = `${percent.toFixed(2)}%`;
    elements.unlockedCount.textContent = String(count);
    elements.remainingCount.textContent = String(TOTAL - count);
    elements.percentage.textContent = percentage;
    elements.headerCount.textContent = String(count);
    elements.poolSize.textContent = String(TOTAL - count);
    elements.progressBar.style.width = `${percent}%`;
    elements.sheetCount.textContent = `${count} / ${TOTAL}`;
    elements.sheetPercentage.textContent = `${percentage} COMPLETE`;
    elements.clear.disabled = count === 0;
    renderList();
  }

  function renderList() {
    elements.list.replaceChildren();
    if (!unlockedIds.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "还没有已解锁的洞。转动城市，开始第一站。";
      elements.list.append(empty);
      return;
    }

    [...unlockedIds].reverse().forEach((id, index) => {
      const dong = byId.get(id);
      const row = document.createElement("div");
      row.className = "unlocked-item";
      row.innerHTML = `
        <span class="unlocked-index">${String(unlockedIds.length - index).padStart(3, "0")}</span>
        <span class="unlocked-place"><strong>${dong.name}</strong><span>${dong.district}</span></span>
        <button class="undo-button" type="button" data-undo="${dong.id}">撤销</button>
      `;
      elements.list.append(row);
    });
  }

  function undo(id) {
    const dong = byId.get(id);
    unlockedIds = unlockedIds.filter((item) => item !== id);
    saveProgress();
    renderProgress();
    if (unlockedIds.length < TOTAL && !current) setReady();
    showToast(`${dong.district} · ${dong.name} 已放回随机池`);
  }

  function openSheet() {
    lastFocus = document.activeElement;
    elements.sheetBackdrop.hidden = false;
    elements.sheet.hidden = false;
    document.body.classList.add("has-overlay");
    elements.closeList.focus();
  }

  function closeSheet() {
    elements.sheetBackdrop.hidden = true;
    elements.sheet.hidden = true;
    document.body.classList.remove("has-overlay");
    lastFocus?.focus?.();
  }

  function openClearDialog() {
    if (!unlockedIds.length) return;
    elements.dialogBackdrop.hidden = false;
    elements.cancelClear.focus();
  }

  function closeClearDialog() {
    elements.dialogBackdrop.hidden = true;
    elements.clear.focus();
  }

  function clearProgress() {
    unlockedIds = [];
    current = null;
    localStorage.removeItem(STORAGE_KEY);
    elements.dialogBackdrop.hidden = true;
    renderProgress();
    closeSheet();
    setReady();
    showToast("进度已清空，427 个洞全部回到随机池");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
  }

  elements.spin.addEventListener("click", () => startSpin());
  elements.confirm.addEventListener("click", confirmSelection);
  elements.reroll.addEventListener("click", reroll);
  elements.next.addEventListener("click", () => {
    setReady();
    startSpin();
  });
  elements.openList.addEventListener("click", openSheet);
  elements.openListSecondary.addEventListener("click", openSheet);
  elements.closeList.addEventListener("click", closeSheet);
  elements.sheetBackdrop.addEventListener("click", closeSheet);
  elements.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-undo]");
    if (button) undo(button.dataset.undo);
  });
  elements.clear.addEventListener("click", openClearDialog);
  elements.cancelClear.addEventListener("click", closeClearDialog);
  elements.confirmClear.addEventListener("click", clearProgress);
  elements.dialogBackdrop.addEventListener("click", (event) => {
    if (event.target === elements.dialogBackdrop) closeClearDialog();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!elements.dialogBackdrop.hidden) closeClearDialog();
    else if (!elements.sheet.hidden) closeSheet();
  });

  renderProgress();
  setReady();
})();
