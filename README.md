# TKA Modul 3 — Ansible
Question Source: [Cloud Computing Practicum Module 1](https://docs.google.com/document/d/1iSmqYck4ForiQHS0A7k94mJsuFTos83HeY6ZkGvxvVA/edit?tab=t.0)

Group Members:

1. Adiwidya @Riverzn
2. Prabaswara @zostradamus
3. Zelig @zelebwr

## Praktikan 1: Adiwidya | Instalasi Docker Engine pada Semua Node

> **Konteks Soal:** Tahun 2067. Sebagai mahasiswa TI yang mempelajari Cloud Computing dan Infrastructure as Code (IaC), tugas ini mensimulasikan deployment web login menggunakan Ansible ke dua VM node yang masing-masing punya peran berbeda (backend & frontend).

---

## Daftar Isi
- [Struktur Folder](#struktur-folder)
- [Kendala & Penyesuaian](#kendala--penyesuaian)
- [Langkah Pengerjaan](#langkah-pengerjaan)
  - [Step 1 — Instalasi Multipass di Windows](#step-1--instalasi-multipass-di-windows)
  - [Step 2 — Membuat VM Node dengan Bridge Network](#step-2--membuat-vm-node-dengan-bridge-network)
  - [Step 3 — Instalasi Ansible di Kali Linux WSL](#step-3--instalasi-ansible-di-kali-linux-wsl)
  - [Step 4 — Setup SSH Key](#step-4--setup-ssh-key)
  - [Step 5 — Membuat Struktur Project](#step-5--membuat-struktur-project)
  - [Step 6 — Membuat inventory.yml](#step-6--membuat-inventoryyml)
  - [Step 7 — Ansible Ping Test](#step-7--ansible-ping-test)
  - [Step 8 — Membuat Role Docker](#step-8--membuat-role-docker)
  - [Step 9 — Membuat Playbook Utama](#step-9--membuat-playbook-utama)
  - [Step 10 — Menjalankan Playbook](#step-10--menjalankan-playbook)
  - [Step 11 — Verifikasi Manual](#step-11--verifikasi-manual)
- [Checklist](#checklist)

---

## Struktur Folder

```
praktikum-tka-modul-3/
├── README.md
├── inventory.yml
├── site.yml
└── roles/
    └── docker/
        ├── tasks/
        │   └── main.yml
        └── handlers/
```
---

## Langkah Pengerjaan

### Step 1 — Instalasi Multipass di Windows

Buka **PowerShell sebagai Administrator**, jalankan:

```powershell
winget install Canonical.Multipass
```

Restart PowerShell/terminal setelah instalasi selesai, lalu verifikasi:

```powershell
multipass version
```

---

### Step 2 — Membuat VM Node dengan Bridge Network

Buat dua VM node menggunakan jaringan bridge ke adaptor Wi-Fi:

```powershell
multipass launch --name node1 --cpus 1 --memory 1G --disk 5G --network Wi-Fi
multipass launch --name node2 --cpus 1 --memory 1G --disk 5G --network Wi-Fi
```

Cek daftar VM dan catat IP-nya:

```powershell
multipass list
```

Output contoh:
```
Name    State    IPv4             Image
node1   Running  192.168.1.10    Ubuntu 22.04 LTS
node2   Running  192.168.1.11    Ubuntu 22.04 LTS
```

> Catat IP `node1` dan `node2` — akan dipakai di `inventory.yml`.

---

### Step 3 — Instalasi Ansible di Kali Linux WSL

Buka terminal **Kali Linux WSL**, jalankan:

```bash
sudo apt update
sudo apt install ansible -y
ansible --version
```

---

### Step 4 — Setup SSH Key

#### 4a. Generate SSH Key di Kali Linux

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
cat ~/.ssh/id_rsa.pub
```

Salin seluruh output teks publik key tersebut.

#### 4b. Tanam Key ke node1 (via PowerShell Windows)

```powershell
# Di PowerShell Windows
multipass shell node1
```

Di dalam shell node1:

```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
# Paste teks public key dari Kali, lalu Ctrl+X → Y → Enter
chmod 600 ~/.ssh/authorized_keys
exit
```

Ulangi langkah yang sama untuk `node2`:

```powershell
multipass shell node2
```

#### 4c. Test Koneksi SSH dari Kali Linux

```bash
ssh ubuntu@<IP_NODE1>
# Ketik 'yes' saat pertama kali, lalu exit
ssh ubuntu@<IP_NODE2>
# Ketik 'yes' saat pertama kali, lalu exit
```

Jika berhasil masuk **tanpa password**, SSH sudah siap ✅

---

### Step 5 — Membuat Struktur Project

Di terminal **Kali Linux**, masuk ke folder repo dan buat struktur folder:

```bash
cd ~/College/tka/praktikum-tka-modul-3
mkdir -p roles/docker/{tasks,handlers}
```

Verifikasi struktur:

```bash
tree .
```

---

### Step 6 — Membuat `inventory.yml`

```bash
nano inventory.yml
```

```yaml
all:
  children:
    backend:
      hosts:
        node1:
          ansible_host: <IP_NODE1>      # Ganti dengan IP dari multipass list
          ansible_user: ubuntu
          ansible_ssh_private_key_file: ~/.ssh/id_rsa
    frontend:
      hosts:
        node2:
          ansible_host: <IP_NODE2>      # Ganti dengan IP dari multipass list
          ansible_user: ubuntu
          ansible_ssh_private_key_file: ~/.ssh/id_rsa
```

> - `node1` masuk group **backend**
> - `node2` masuk group **frontend**
> - Kedua node dalam group berbeda sesuai soal

---

### Step 7 — Ansible Ping Test

```bash
ansible all -i inventory.yml -m ping
```

Output yang diharapkan:

```
node1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
node2 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

---

### Step 8 — Membuat Role Docker

```bash
nano roles/docker/tasks/main.yml
```

```yaml
---
# ============================================================
# INSTALL DOCKER ENGINE
# ============================================================

- name: Update apt cache
  apt:
    update_cache: yes
  become: yes

- name: Install dependencies Docker
  apt:
    name:
      - ca-certificates
      - curl
      - gnupg
      - lsb-release
      - apt-transport-https
    state: present
  become: yes

- name: Buat direktori keyring
  file:
    path: /etc/apt/keyrings
    state: directory
    mode: '0755'
  become: yes

- name: Download GPG key Docker
  shell: |
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  args:
    creates: /etc/apt/keyrings/docker.gpg
  become: yes

- name: Tambah repository Docker
  shell: |
    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  args:
    creates: /etc/apt/sources.list.d/docker.list
  become: yes

- name: Update apt setelah tambah repo Docker
  apt:
    update_cache: yes
  become: yes

- name: Install Docker Engine
  apt:
    name:
      - docker-ce
      - docker-ce-cli
      - containerd.io
      - docker-buildx-plugin
      - docker-compose-plugin
    state: present
  become: yes

- name: Start dan enable service Docker
  service:
    name: docker
    state: started
    enabled: yes
  become: yes

- name: Tambah user ubuntu ke group docker
  user:
    name: ubuntu
    groups: docker
    append: yes
  become: yes

# ============================================================
# SETUP FIREWALL UFW — Hanya port 22 yang terbuka
# ============================================================

- name: Install UFW
  apt:
    name: ufw
    state: present
  become: yes

- name: Reset UFW ke default
  ufw:
    state: reset
  become: yes

- name: Izinkan port 22 (SSH)
  ufw:
    rule: allow
    port: '22'
    proto: tcp
  become: yes

- name: Set UFW default incoming deny
  ufw:
    default: deny
    direction: incoming
  become: yes

- name: Aktifkan UFW
  ufw:
    state: enabled
  become: yes
```

---

### Step 9 — Membuat Playbook Utama

```bash
nano site.yml
```

```yaml
---
- name: Install Docker Engine pada semua node
  hosts: all
  become: yes
  roles:
    - docker
```

---

### Step 10 — Menjalankan Playbook

```bash
ansible-playbook -i inventory.yml site.yml
```

Tunggu hingga selesai. Semua task harus berstatus `ok` atau `changed`, **tidak ada** `failed`.

---

### Step 11 — Verifikasi Manual

SSH ke masing-masing node dan jalankan Docker Hello World:

```bash
# Node 1
ssh ubuntu@<IP_NODE1>
docker run hello-world
exit

# Node 2
ssh ubuntu@<IP_NODE2>
docker run hello-world
exit
```

Output yang diharapkan:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

---

---

*Praktikum TKA 2026 — Modul 3 Ansible*
