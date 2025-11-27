// === KONEKSI KE SUPABASE ===
const SUPABASE_URL = "https://sjdytaaatjndhgjfsxfc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqZHl0YWFhdGpuZGhnamZzeGZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzI2NDIsImV4cCI6MjA3NTE0ODY0Mn0.-EYx3sDrtfdJAweZO_V_gPHyD-Cqdg6YczuaXzl2J1E";
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMEN DOM ===
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

// === EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', () => {
  // Cek jika sudah login
  checkExistingSession();
  
  loginForm.addEventListener('submit', handleLogin);
});

// === CHECK EXISTING SESSION ===
async function checkExistingSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (session && session.user) {
      // Cek apakah user adalah admin
      const isAdmin = await checkAdminUser(session.user.id);
      if (isAdmin) {
        window.location.href = 'admin.html';
        return;
      } else {
        // Jika user bukan admin, sign out
        await supabase.auth.signOut();
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminUser');
      }
    }
  } catch (error) {
    console.error('Error checking session:', error);
    // Clear any existing session data
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
  }
}

// === CHECK ADMIN USER ===
async function checkAdminUser(userId) {
  try {
    // Query ke tabel admin_users untuk memverifikasi user adalah admin
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      // Jika tabel tidak ada, kita akan buat otomatis nanti
      console.log('Admin users table might not exist yet:', error.message);
      return false;
    }

    return !!adminUser;
  } catch (error) {
    console.error('Error checking admin user:', error);
    return false;
  }
}

// === LOGIN HANDLER ===
async function handleLogin(e) {
  e.preventDefault();
  
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  
  // Set loading state
  submitBtn.disabled = true;
  submitBtn.classList.add('loading');
  
  try {
    const formData = new FormData(loginForm);
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    // Validasi input
    if (!email || !password) {
      throw new Error('Harap isi email dan password!');
    }

    // Sign in dengan Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authError) {
      // Handle specific error cases
      if (authError.message.includes('Invalid login credentials')) {
        throw new Error('Email atau password salah!');
      } else if (authError.message.includes('Email not confirmed')) {
        throw new Error('Email belum dikonfirmasi!');
      } else {
        throw new Error(`Login gagal: ${authError.message}`);
      }
    }

    if (!authData.user) {
      throw new Error('Login gagal: User tidak ditemukan');
    }

    // Verifikasi bahwa user adalah admin
    const isAdmin = await checkAdminUser(authData.user.id);
    
    if (!isAdmin) {
      // Jika bukan admin, sign out dan tampilkan error
      await supabase.auth.signOut();
      throw new Error('Anda tidak memiliki akses ke panel admin!');
    }

    // Simpan status login
    localStorage.setItem('adminLoggedIn', 'true');
    localStorage.setItem('adminUser', JSON.stringify({
      id: authData.user.id,
      email: authData.user.email
    }));
    
    showLoginMessage('Login berhasil! Mengarahkan ke panel admin...', 'success');
    
    // Redirect ke admin page setelah 1 detik
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 1000);
    
  } catch (error) {
    console.error('Login error:', error);
    showLoginMessage(error.message, 'error');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitBtn.classList.remove('loading');
    submitBtn.innerHTML = originalText;
  }
}

// === SHOW LOGIN MESSAGE ===
function showLoginMessage(message, type) {
  loginMessage.textContent = message;
  loginMessage.className = `login-message ${type}`;
  
  // Auto hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      loginMessage.style.display = 'none';
    }, 3000);
  }
}

// === LOGOUT FUNCTION ===
async function logout() {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect anyway
    localStorage.removeItem('adminLoggedIn');
    localStorage.removeItem('adminUser');
    window.location.href = 'login.html';
  }
}

// === SETUP ADMIN USERS (Fungsi untuk setup awal) ===
async function setupAdminUsers() {
  // Fungsi ini hanya dijalankan sekali untuk setup admin users
  // Anda perlu menjalankan fungsi ini dari console browser setelah membuat tabel
  
  const adminUsers = [
    {
      email: "admin@duniakultivator.com",
      password: "Admin123!",
      name: "Super Administrator"
    },
    {
      email: "administrator@duniakultivator.com", 
      password: "Admin456!",
      name: "Administrator"
    }
  ];

  for (const admin of adminUsers) {
    try {
      // Daftarkan user baru
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: {
            name: admin.name,
            role: 'admin'
          }
        }
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          console.log(`User ${admin.email} sudah terdaftar`);
          continue;
        }
        throw authError;
      }

      if (authData.user) {
        // Tambahkan ke tabel admin_users
        const { error: adminError } = await supabase
          .from('admin_users')
          .insert({
            user_id: authData.user.id,
            email: admin.email,
            name: admin.name,
            role: 'super_admin',
            is_active: true
          });

        if (adminError) {
          console.error(`Error adding ${admin.email} to admin_users:`, adminError);
        } else {
          console.log(`Admin user ${admin.email} berhasil dibuat`);
        }
      }
    } catch (error) {
      console.error(`Error setting up admin user ${admin.email}:`, error);
    }
  }
}

// Untuk menjalankan setup, buka console browser dan ketik:
// setupAdminUsers()