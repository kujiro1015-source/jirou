(() => {
  "use strict";

  const STORAGE = {
    cash: "kujiro.cash.v1",
    invested: "kujiro.invested.v1",
    habits: "kujiro.habits.v1",
    notes: "kujiro.notes.v1"
  };

  const $ = (selector) => document.querySelector(selector);
  const cashInput = $("#cashInput");
  const investInput = $("#investInput");
  const assetTotal = $("#assetTotal");
  const habitList = $("#habitList");
  const habitCount = $("#habitCount");
  const habitProgress = $("#habitProgress");
  const noteForm = $("#noteForm");
  const noteTitle = $("#noteTitle");
  const noteBody = $("#noteBody");
  const notesList = $("#notesList");
  const notesCount = $("#notesCount");
  const charCount = $("#charCount");
  const formMessage = $("#formMessage");
  const toast = $("#toast");
  const importFile = $("#importFile");

  let notes = readJSON(STORAGE.notes, []);
  let habits = readJSON(STORAGE.habits, {});
  let editingId = null;
  let toastTimer = null;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`Could not read ${key}`, error);
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast("保存できませんでした。ブラウザの保存容量を確認してください。");
      console.error(error);
      return false;
    }
  }

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function updateClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString("ja-JP", {
      hour: "2-digit", minute: "2-digit", hour12: false
    });
    $("#fullDate").textContent = now.toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric", weekday: "short"
    });
    $("#todayLabel").textContent = now.toLocaleDateString("en-US", {
      month: "short", day: "2-digit", year: "numeric"
    }).toUpperCase();
  }

  function yen(value) {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency", currency: "JPY", maximumFractionDigits: 0
    }).format(value);
  }

  function updateAssetTotal() {
    const cashRaw = cashInput.value.trim();
    const investRaw = investInput.value.trim();
    const hasCash = cashRaw !== "" && Number.isFinite(Number(cashRaw));
    const hasInvest = investRaw !== "" && Number.isFinite(Number(investRaw));
    if (!hasCash && !hasInvest) {
      assetTotal.textContent = "未入力";
      return;
    }
    const total = (hasCash ? Math.max(0, Number(cashRaw)) : 0) +
                  (hasInvest ? Math.max(0, Number(investRaw)) : 0);
    assetTotal.textContent = yen(total);
  }

  function initAssets() {
    cashInput.value = readJSON(STORAGE.cash, "");
    investInput.value = readJSON(STORAGE.invested, "");
    updateAssetTotal();
    cashInput.addEventListener("input", () => {
      saveJSON(STORAGE.cash, cashInput.value);
      updateAssetTotal();
    });
    investInput.addEventListener("input", () => {
      saveJSON(STORAGE.invested, investInput.value);
      updateAssetTotal();
    });
  }

  function initHabits() {
    const today = localDateKey();
    const todaysHabits = habits[today] || {};
    habitList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = Boolean(todaysHabits[checkbox.dataset.habit]);
      checkbox.addEventListener("change", () => {
        if (!habits[today]) habits[today] = {};
        habits[today][checkbox.dataset.habit] = checkbox.checked;
        saveJSON(STORAGE.habits, habits);
        updateHabits();
      });
    });
    updateHabits();
  }

  function updateHabits() {
    const boxes = [...habitList.querySelectorAll('input[type="checkbox"]')];
    const checked = boxes.filter((box) => box.checked).length;
    habitCount.textContent = `${checked} / ${boxes.length}`;
    habitProgress.style.width = boxes.length ? `${checked / boxes.length * 100}%` : "0%";
  }

  function updateCharCount() {
    charCount.textContent = `${noteBody.value.length} / 5000`;
  }

  function formatNoteDate(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "日付不明";
    return date.toLocaleString("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function createNoteElement(note) {
    const article = document.createElement("article");
    article.className = "note-card";

    const top = document.createElement("div");
    top.className = "note-card-top";
    const title = document.createElement("h4");
    title.textContent = note.title || "無題のメモ";
    const date = document.createElement("time");
    date.className = "note-date";
    date.dateTime = note.updatedAt || note.createdAt;
    date.textContent = formatNoteDate(note.updatedAt || note.createdAt);
    top.append(title, date);
    article.append(top);

    if (note.body) {
      const body = document.createElement("p");
      body.className = "note-body";
      body.textContent = note.body;
      article.append(body);
    }

    const actions = document.createElement("div");
    actions.className = "note-actions";
    const edit = document.createElement("button");
    edit.className = "small-button";
    edit.type = "button";
    edit.textContent = "編集";
    edit.addEventListener("click", () => startEditing(note.id));
    const remove = document.createElement("button");
    remove.className = "small-button danger";
    remove.type = "button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => deleteNote(note.id));
    actions.append(edit, remove);
    article.append(actions);
    return article;
  }

  function renderNotes() {
    notesList.replaceChildren();
    const sorted = [...notes].sort((a, b) =>
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
    notesCount.textContent = `${notes.length}件`;
    if (!sorted.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "まだ記録はありません。最初のメモを書いてみよう。";
      notesList.append(empty);
      return;
    }
    sorted.slice(0, 30).forEach((note) => notesList.append(createNoteElement(note)));
    if (sorted.length > 30) {
      const more = document.createElement("p");
      more.className = "microcopy";
      more.textContent = `最新30件を表示中（全${sorted.length}件）。バックアップには全件含まれます。`;
      notesList.append(more);
    }
  }

  function resetNoteForm() {
    editingId = null;
    noteTitle.value = "";
    noteBody.value = "";
    $("#noteForm button[type='submit']").innerHTML = '記録を保存 <span>↗</span>';
    updateCharCount();
  }

  function startEditing(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    editingId = id;
    noteTitle.value = note.title || "";
    noteBody.value = note.body || "";
    $("#noteForm button[type='submit']").innerHTML = '変更を保存 <span>↗</span>';
    updateCharCount();
    noteTitle.focus();
    noteForm.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function deleteNote(id) {
    const note = notes.find((item) => item.id === id);
    if (!note) return;
    if (!window.confirm(`「${note.title || "無題のメモ"}」を削除しますか？`)) return;
    notes = notes.filter((item) => item.id !== id);
    if (!saveJSON(STORAGE.notes, notes)) return;
    if (editingId === id) resetNoteForm();
    renderNotes();
    showToast("記録を削除しました。");
  }

  noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = noteTitle.value.trim();
    const body = noteBody.value.trim();
    if (!title && !body) {
      formMessage.textContent = "タイトルか内容を入力してください。";
      noteBody.focus();
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      const index = notes.findIndex((note) => note.id === editingId);
      if (index >= 0) notes[index] = { ...notes[index], title, body, updatedAt: now };
    } else {
      notes.push({
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title, body, createdAt: now, updatedAt: now
      });
    }
    if (!saveJSON(STORAGE.notes, notes)) return;
    resetNoteForm();
    renderNotes();
    formMessage.textContent = "保存しました。";
    showToast("メモ・日記を保存しました。");
  });

  noteBody.addEventListener("input", updateCharCount);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function exportData() {
    const data = {
      app: "KUJIRO DASHBOARD",
      version: 1,
      exportedAt: new Date().toISOString(),
      cash: cashInput.value,
      invested: investInput.value,
      habits,
      notes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kujiro-dashboard-backup-${localDateKey()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("バックアップファイルを作成しました。");
  }

  $("#exportBtn").addEventListener("click", () => {
    const shouldImport = window.confirm("OK：バックアップを書き出す\nキャンセル：バックアップを読み込む");
    if (shouldImport) exportData();
    else importFile.click();
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "KUJIRO DASHBOARD" || !Array.isArray(data.notes) || typeof data.habits !== "object") {
        throw new Error("このアプリのバックアップではありません。");
      }
      if (!window.confirm("現在のデータをバックアップの内容で置き換えます。続けますか？")) return;
      cashInput.value = data.cash ?? "";
      investInput.value = data.invested ?? "";
      habits = data.habits || {};
      notes = data.notes || [];
      saveJSON(STORAGE.cash, cashInput.value);
      saveJSON(STORAGE.invested, investInput.value);
      saveJSON(STORAGE.habits, habits);
      saveJSON(STORAGE.notes, notes);
      updateAssetTotal();
      initHabits();
      renderNotes();
      showToast("バックアップを読み込みました。");
    } catch (error) {
      window.alert(`読み込みに失敗しました：${error.message}`);
    } finally {
      importFile.value = "";
    }
  });

  updateClock();
  window.setInterval(updateClock, 1000);
  initAssets();
  initHabits();
  updateCharCount();
  renderNotes();
})();
