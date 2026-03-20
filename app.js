/* --------------------------------------------------------------
   Tet's Coffee Roastery – Complete Application Logic
   --------------------------------------------------------------
   Features:
   • Firebase Auth (Email/Password) – login, register, logout
   • Firestore CRUD for:
        – inventory collection (green coffee beans)
        – roasts collection (roasting records)
   • Dashboard statistics (total inventory, total roasts,
     avg. yield, weekly output, recent roasts)
   • CSV export for both collections
   • Modals for Add/Edit Inventory & Roast
   • Toast notifications
   • Responsive UI wiring (nav, sections, form validation)
   -------------------------------------------------------------- */

/* --------------------------------------------------------------
   1️⃣  Firebase Configuration & Initialization
   -------------------------------------------------------------- */
const firebaseConfig = {
    apiKey: "AIzaSyB3XJrRZNxx7tyHOugd49k_kEQUhxp2R60",
    authDomain: "tet-s-coffee-roastery.firebaseapp.com",
    projectId: "tet-s-coffee-roastery",
    // NOTE: storage bucket must end with *.appspot.com
    storageBucket: "tet-s-coffee-roastery.appspot.com",
    messagingSenderId: "68019552831",
    appId: "1:68019552831:web:c6111a7f30b3c16156ae8a",
    measurementId: "G-CR4EKB2RB5"
};

// Load Firebase SDKs (compat version – matches the HTML script tags)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

/* --------------------------------------------------------------
   2️⃣  UI ELEMENT REFERENCES
   -------------------------------------------------------------- */
const loginScreen   = document.getElementById('login-screen');
const appContainer  = document.getElementById('app');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn     = document.getElementById('logout-btn');

const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn      = document.getElementById('login-btn');
const registerBtn   = document.getElementById('register-btn');
const authError     = document.getElementById('auth-error');

const navButtons    = document.querySelectorAll('.nav-btn');
const sections      = document.querySelectorAll('.section');

const addRoastBtn        = document.getElementById('add-roast-btn');
const roastModal         = document.getElementById('roast-modal');
const roastForm          = document.getElementById('roast-form');
const roastModalCloseBtn = document.querySelector('#roast-modal .modal-close');
const cancelRoastBtn     = document.getElementById('cancel-roast');

const addInventoryBtn        = document.getElementById('add-inventory-btn');
const inventoryModal        = document.getElementById('inventory-modal');
const inventoryForm         = document.getElementById('inventory-form');
const inventoryModalCloseBtn = document.querySelector('#inventory-modal .modal-close');
const cancelInventoryBtn    = document.getElementById('cancel-inventory');

const toast         = document.getElementById('toast');
const toastMessage  = document.getElementById('toast-message');

const exportRoastsBtn    = document.getElementById('btn-export-roasts');
const exportInventoryBtn = document.getElementById('btn-export-inventory');

/* --------------------------------------------------------------
   3️⃣  Helper Functions (Toast, Error Display, UI Show/Hide)
   -------------------------------------------------------------- */
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}
function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
}
function clearAuthError() {
    authError.textContent = '';
    authError.style.display = 'none';
}
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
    clearAuthError();
}
function showAppScreen() {
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userEmailSpan.textContent = auth.currentUser.email;
}
function activateSection(sectionId) {
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // update nav button active state
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.id === `show-${sectionId}`);
    });
}

/* --------------------------------------------------------------
   4️⃣  Authentication Flow
   -------------------------------------------------------------- */
loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const pwd   = passwordInput.value;
    if (!email || !pwd) {
        showAuthError('Please fill in both email and password.');
        return;
    }
    auth.signInWithEmailAndPassword(email, pwd)
        .then(() => {
            showToast('Logged in successfully');
            // onAuthStateChanged will handle UI change
        })
        .catch(err => showAuthError(err.message));
});

registerBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const pwd   = passwordInput.value;
    if (!email || !pwd) {
        showAuthError('Please fill in both email and password.');
        return;
    }
    if (pwd.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        return;
    }
    auth.createUserWithEmailAndPassword(email, pwd)
        .then(() => {
            showToast('Account created successfully');
        })
        .catch(err => showAuthError(err.message));
});

logoutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => showToast('Logged out'))
        .catch(err => showToast('Logout error: ' + err.message));
});

/* React to sign‑in / sign‑out state changes */
auth.onAuthStateChanged(user => {
    if (user) {
        showAppScreen();
        loadAllData();      // populate UI after login
    } else {
        showLoginScreen();
    }
});

/* --------------------------------------------------------------
   5️⃣  Navigation
   -------------------------------------------------------------- */
navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.id.replace('show-','');
        activateSection(target);
    });
});

/* --------------------------------------------------------------
   6️⃣  Modal Management
   -------------------------------------------------------------- */
function openRoastModal(data = null) {
    // Reset form
    roastForm.reset();
    document.getElementById('roast-id').value = '';
    document.getElementById('roast-modal-title').textContent = 'Add New Roast';
    // Pre‑fill if editing
    if (data) {
        document.getElementById('roast-id').value       = data.id;
        document.getElementById('roast-date').value     = data.date;
        document.getElementById('roast-bean').value     = data.bean;
        document.getElementById('roast-origin').value   = data.origin || '';
        document.getElementById('roast-variety').value  = data.variety || 'Arabica';
        document.getElementById('roast-input').value    = data.input;
        document.getElementById('roast-output').value   = data.output;
        document.getElementById('roast-notes').value    = data.notes || '';
        document.getElementById('roast-modal-title').textContent = 'Edit Roast';
    }
    roastModal.classList.remove('hidden');
}
function closeRoastModal() { roastModal.classList.add('hidden'); }

function openInventoryModal(data = null) {
    inventoryForm.reset();
    document.getElementById('inventory-id').value = '';
    document.getElementById('inventory-modal-title').textContent = 'Add Inventory Item';
    if (data) {
        document.getElementById('inventory-id').value         = data.id;
        document.getElementById('inventory-bean').value       = data.bean;
        document.getElementById('inventory-quantity').value   = data.quantity;
        document.getElementById('inventory-origin').value    = data.origin;
        document.getElementById('inventory-variety').value   = data.variety || 'Arabica';
        document.getElementById('inventory-process').value  = data.process || 'Washed';
        document.getElementById('inventory-notes').value     = data.notes || '';
        document.getElementById('inventory-modal-title').textContent = 'Edit Inventory Item';
    }
    inventoryModal.classList.remove('hidden');
}
function closeInventoryModal() { inventoryModal.classList.add('hidden'); }

/* Click overlay or close button to hide modals */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
        closeRoastModal();
        closeInventoryModal();
    });
});
roastModalCloseBtn.addEventListener('click', closeRoastModal);
cancelRoastBtn.addEventListener('click', closeRoastModal);
inventoryModalCloseBtn.addEventListener('click', closeInventoryModal);
cancelInventoryBtn.addEventListener('click', closeInventoryModal);

/* Button triggers */
addRoastBtn.addEventListener('click', () => openRoastModal());
addInventoryBtn.addEventListener('click', () => openInventoryModal());

/* --------------------------------------------------------------
   7️⃣  CSV Export (uses helpers defined later)
   -------------------------------------------------------------- */
exportRoastsBtn.addEventListener('click', () => exportRoastsCSV());
exportInventoryBtn.addEventListener('click', () => exportInventoryCSV());

/* --------------------------------------------------------------
   8️⃣  Form Submissions (Create / Update)
   -------------------------------------------------------------- */
function submitRoast(e) {
    e.preventDefault();

    const id          = document.getElementById('roast-id').value;
    const date        = document.getElementById('roast-date').value;
    const bean        = document.getElementById('roast-bean').value.trim();
    const origin      = document.getElementById('roast-origin').value.trim();
    const variety     = document.getElementById('roast-variety').value;
    const input       = parseFloat(document.getElementById('roast-input').value);
    const output      = parseFloat(document.getElementById('roast-output').value);
    const notes       = document.getElementById('roast-notes').value.trim();

    if (!date || !bean || isNaN(input) || isNaN(output)) {
        showToast('Please fill in all required fields.');
        return;
    }

    const roastObj = {
        date,
        bean,
        origin,
        variety,
        input,
        output,
        notes,
        userId: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const collection = db.collection('roasts');

    if (id) {
        // UPDATE
        collection.doc(id).update(roastObj)
            .then(() => {
                closeRoastModal();
                loadRoasts();
                loadDashboard();
                showToast('Roast updated');
            })
            .catch(err => showToast('Error updating roast: ' + err.message));
    } else {
        // CREATE
        collection.add(roastObj)
            .then(() => {
                closeRoastModal();
                loadRoasts();
                loadDashboard();
                showToast('Roast added');
            })
            .catch(err => showToast('Error adding roast: ' + err.message));
    }
}
roastForm.addEventListener('submit', submitRoast);

function submitInventory(e) {
    e.preventDefault();

    const id       = document.getElementById('inventory-id').value;
    const bean     = document.getElementById('inventory-bean').value.trim();
    const quantity = parseFloat(document.getElementById('inventory-quantity').value);
    const origin   = document.getElementById('inventory-origin').value.trim();
    const variety  = document.getElementById('inventory-variety').value;
    const process  = document.getElementById('inventory-process').value;
    const notes    = document.getElementById('inventory-notes').value.trim();

    if (!bean || isNaN(quantity) || !origin) {
        showToast('Please fill in all required fields.');
        return;
    }

    const itemObj = {
        bean,
        quantity,
        origin,
        variety,
        process,
        notes,
        userId: auth.currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    const collection = db.collection('inventory');

    if (id) {
        // UPDATE
        collection.doc(id).update(itemObj)
            .then(() => {
                closeInventoryModal();
                loadInventory();
                loadDashboard();
                showToast('Inventory item updated');
            })
            .catch(err => showToast('Error updating inventory: ' + err.message));
    } else {
        // CREATE
        collection.add(itemObj)
            .then(() => {
                closeInventoryModal();
                loadInventory();
                loadDashboard();
                showToast('Inventory item added');
            })
            .catch(err => showToast('Error adding inventory: ' + err.message));
    }
}
inventoryForm.addEventListener('submit', submitInventory);

/* --------------------------------------------------------------
   9️⃣  Data Loading (Dashboard, Inventory Table, Roasts Table)
   -------------------------------------------------------------- */
function loadAllData() {
    loadDashboard();
    loadInventory();
    loadRoasts();
}

/* ---- Dashboard ---- */
function loadDashboard() {
    const userId = auth.currentUser.uid;

    // ***** TOTAL INVENTORY *****
    db.collection('inventory')
        .where('userId', '==', userId)
        .get()
        .then(snap => {
            let totalKg = 0;
            snap.forEach(doc => totalKg += doc.data().quantity);
            document.getElementById('total-inventory').textContent = totalKg.toFixed(1) + ' kg';
        })
        .catch(err => console.error('Dashboard inventory error:', err));

    // ***** TOTAL ROASTS, AVG YIELD *****
    db.collection('roasts')
        .where('userId', '==', userId)
        .get()
        .then(snap => {
            const count = snap.size;
            document.getElementById('total-roasts').textContent = count;

            // avg yield
            let totalYield = 0;
            let yieldCount = 0;
            snap.forEach(doc => {
                const d = doc.data();
                if (d.input > 0) {
                    totalYield += (d.output / d.input) * 100;
                    yieldCount++;
                }
            });
            const avgYield = yieldCount ? (totalYield / yieldCount).toFixed(1) : 0;
            document.getElementById('avg-yield').textContent = avgYield + '%';
        })
        .catch(err => console.error('Dashboard roasts error:', err));

    // ***** WEEKLY OUTPUT (last 7 days) *****
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    db.collection('roasts')
        .where('userId', '==', userId)
        .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(weekAgo))
        .get()
        .then(snap => {
            let weekOutput = 0;
            snap.forEach(doc => weekOutput += doc.data().output);
            document.getElementById('week-output').textContent = weekOutput.toFixed(1) + ' kg';
        })
        .catch(err => console.error('Weekly output error:', err));

    // ***** RECENT ROASTS LIST (5 most recent) *****
    const recentElm = document.getElementById('recent-roasts');
    recentElm.innerHTML = '<p>Loading recent roasts…</p>';

    db.collection('roasts')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get()
        .then(snap => {
            if (snap.empty) {
                recentElm.innerHTML = '<p>No recent roasts yet.</p>';
                return;
            }
            const container = document.createElement('div');
            snap.forEach(doc => {
                const d = doc.data();
                const yieldPct = d.input > 0 ? ((d.output / d.input) * 100).toFixed(1) : '0';
                const item = document.createElement('div');
                item.className = 'roast-item';
                item.innerHTML = `<strong>${d.bean}</strong> – ${d.input.toFixed(1)} kg → ${d.output.toFixed(1)} kg (${yieldPct}% yield) on ${d.date}`;
                container.appendChild(item);
            });
            recentElm.innerHTML = '';
            recentElm.appendChild(container);
        })
        .catch(err => {
            recentElm.innerHTML = '<p>Error loading recent roasts.</p>';
            console.error('Recent roasts error:', err);
        });
}

/* ---- Inventory Table ---- */
function loadInventory() {
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = '<tr><td colspan="6">Loading inventory…</td></tr>';

    db.collection('inventory')
        .where('userId', '==', auth.currentUser.uid)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snap => {
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="6">No inventory items yet. Add some!</td></tr>';
                return;
            }

            const rows = [];
            snap.forEach(doc => {
                const d = doc.data();
                rows.push(`
                    <tr>
                        <td>${d.bean}</td>
                        <td>${d.origin}</td>
                        <td>${d.variety}</td>
                        <td>${d.process}</td>
                        <td>${d.quantity.toFixed(1)}</td>
                        <td>
                            <button class="action-btn edit-btn" onclick="editInventoryItem('${doc.id}')"><i class="fas fa-edit"></i> Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteInventoryItem('${doc.id}')"><i class="fas fa-trash"></i> Delete</button>
                        </td>
                    </tr>
                `);
            });
            tbody.innerHTML = rows.join('');
        })
        .catch(err => {
            tbody.innerHTML = '<tr><td colspan="6">Error loading inventory.</td></tr>';
            console.error('Inventory load error:', err);
        });
}

/* ---- Roasts Table ---------------------------------------------------- */
function loadRoasts() {
    const tbody = document.getElementById('roasts-body');
    tbody.innerHTML = '<tr><td colspan="8">Loading roasts…</td></tr>';

    db.collection('roasts')
        .where('userId', '==', auth.currentUser.uid)
        .orderBy('timestamp', 'desc')
        .get()
        .then(snap => {
            if (snap.empty) {
                tbody.innerHTML = '<tr><td colspan="8">No roasts yet. Add one!</td></tr>';
                return;
            }

            const rows = [];
            snap.forEach(doc => {
                const d = doc.data();
                const yieldPct = d.input > 0 ? ((d.output / d.input) * 100).toFixed(1) : '0';
                rows.push(`
                    <tr>
                        <td>${d.date}</td>
                        <td>${d.bean}</td>
                        <td>${d.origin || '-'}</td>
                        <td>${d.input.toFixed(1)}</td>
                        <td>${d.output.toFixed(1)}</td>
                        <td>${yieldPct}%</td>
                        <td>${d.notes || '-'}</td>
                        <td>
                            <button class="action-btn edit-btn" onclick="editRoastItem('${doc.id}')"><i class="fas fa-edit"></i> Edit</button>
                            <button class="action-btn delete-btn" onclick="deleteRoastItem('${doc.id}')"><i class="fas fa-trash"></i> Delete</button>
                        </td>
                    </tr>
                `);
            });
            tbody.innerHTML = rows.join('');
        })
        .catch(err => {
            tbody.innerHTML = '<tr><td colspan="8">Error loading roasts.</td></tr>';
            console.error('Roasts load error:', err);
        });
}

/* ---- Edit / Delete helpers (Inventory) --------------------------- */
function editInventoryItem(docId) {
    db.collection('inventory').doc(docId).get()
        .then(snap => {
            if (snap.exists) {
                openInventoryModal({ id: docId, ...snap.data() });
            } else {
                showToast('Inventory item not found.');
            }
        })
        .catch(err => {
            console.error('Edit inventory error:', err);
            showToast('Failed to load inventory item.');
        });
}

function deleteInventoryItem(docId) {
    if (!confirm('Delete this inventory item?')) return;
    db.collection('inventory').doc(docId).delete()
        .then(() => {
            loadInventory();
            loadDashboard();
            showToast('Inventory item deleted');
        })
        .catch(err => {
            console.error('Delete inventory error:', err);
            showToast('Failed to delete inventory item.');
        });
}

/* ---- Edit / Delete helpers (Roasts) ------------------------------- */
function editRoastItem(docId) {
    db.collection('roasts').doc(docId).get()
        .then(snap => {
            if (snap.exists) {
                openRoastModal({ id: docId, ...snap.data() });
            } else {
                showToast('Roast not found.');
            }
        })
        .catch(err => {
            console.error('Edit roast error:', err);
            showToast('Failed to load roast.');
        });
}

function deleteRoastItem(docId) {
    if (!confirm('Delete this roast?')) return;
    db.collection('roasts').doc(docId).delete()
        .then(() => {
            loadRoasts();
            loadDashboard();
            showToast('Roast deleted');
        })
        .catch(err => {
            console.error('Delete roast error:', err);
            showToast('Failed to delete roast.');
        });
}

/* --------------------------------------------------------------
   10️⃣  CSV Export Helpers (embedded directly here)
   -------------------------------------------------------------- */
function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const str = val.toString();
    const escaped = str.replace(/"/g, '""');
    return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/* Export Roasts ------------------------------------------------- */
async function exportRoastsCSV() {
    const user = auth.currentUser;
    if (!user) {
        alert('You must be signed in to export data.');
        return;
    }
    try {
        const snap = await db.collection('roasts')
                           .where('userId', '==', user.uid)
                           .orderBy('timestamp', 'desc')
                           .get();

        const headers = [
            'Date','Bean','Origin','Variety',
            'Input (kg)','Output (kg)','Yield (%)','Notes'
        ];
        const rows = [headers.map(csvEscape).join(',')];

        snap.forEach(doc => {
            const d = doc.data();
            const yieldPct = d.input > 0 ? ((d.output / d.input) * 100).toFixed(1) : '0';
            const row = [
                d.date,
                d.bean,
                d.origin || '',
                d.variety || '',
                d.input,
                d.output,
                yieldPct,
                d.notes || ''
            ].map(csvEscape).join(',');
            rows.push(row);
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0,10);
        a.download = `tets_roasts_${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export roasts CSV error:', err);
        alert('Failed to export roasts. See console for details.');
    }
}

/* Export Inventory ---------------------------------------------- */
async function exportInventoryCSV() {
    const user = auth.currentUser;
    if (!user) {
        alert('You must be signed in to export data.');
        return;
    }
    try {
        const snap = await db.collection('inventory')
                           .where('userId', '==', user.uid)
                           .orderBy('timestamp', 'desc')
                           .get();

        const headers = [
            'Bean','Origin','Variety','Process','Quantity (kg)','Notes'
        ];
        const rows = [headers.map(csvEscape).join(',')];

        snap.forEach(doc => {
            const d = doc.data();
            const row = [
                d.bean,
                d.origin,
                d.variety,
                d.process,
                d.quantity,
                d.notes || ''
            ].map(csvEscape).join(',');
            rows.push(row);
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0,10);
        a.download = `tets_inventory_${timestamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Export inventory CSV error:', err);
        alert('Failed to export inventory. See console for details.');
    }
}

/* --------------------------------------------------------------
   11️⃣  Expose functions for inline onclick handlers
   -------------------------------------------------------------- */
window.editInventoryItem   = editInventoryItem;
window.deleteInventoryItem = deleteInventoryItem;
window.editRoastItem       = editRoastItem;
window.deleteRoastItem     = deleteRoastItem;
window.exportRoastsCSV     = exportRoastsCSV;
window.exportInventoryCSV  = exportInventoryCSV;

/* --------------------------------------------------------------
   12️⃣  Initial UI state (default to dashboard)
   -------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // Show dashboard by default when the app loads *after* auth check
    activateSection('dashboard');
});

