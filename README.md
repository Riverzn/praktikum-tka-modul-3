# TKA Modul 3 — Ansible
Question Source: [Cloud Computing Practicum Module 3](https://docs.google.com/document/d/1iSmqYck4ForiQHS0A7k94mJsuFTos83HeY6ZkGvxvVA/edit?tab=t.0)

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

## Praktikan 2: Jonathan | Setup Backend

### Step 1: Setup Bakend Roles Directory

```bash
mkdir -p roles/backend/{tasks,templates,vars,files/app}
touch roles/backend/tasks/main.yml \
      roles/backend/templates/Dockerfile.j2 \
      roles/backend/templates/docker-compose.yml.j2 \
      roles/backend/templates/.env.j2 \
      roles/backend/vars/main.yml \
      roles/backend/files/app/package.json \
      roles/backend/files/app/index.js
```
 
### Step 2: Setup Application Source Code

`roles/backend/files/app/package.json`:

```json
{
  "name": "backend-service",
  "main": "index.js",
  "scripts": {
      "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

`roles/backend/files/app/index.js`:

```json
const express = require('express');
const app = express();
app.get('/', (req, res) => res.status(200).send('Backend Operational'));
app.listen(process.env.PORT || 3000);
```

### Step 3: Configuration Mapping

`vars/main.yml`:

```yaml
db_name: "backend_db"
db_username: "admin"
db_password: "securepassword123"
backend_port: "3000"
jwt_secret: "supersecretjwtkey"
```

`Dockerfile.j2`: 

```j2
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE {{ backend_port }}
CMD ["npm", "start"]
```

`.env.j2`:

```j2
DB_NAME={{ db_name }}
DB_USER={{ db_username }}
DB_PASS={{ db_password }}
PORT={{ backend_port }}
JWT_SECRET={{ jwt_secret }}
```

`docker-compose.yml.j2`:

```j2
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: {{ db_name }}
      POSTGRES_USER: {{ db_username }}
      POSTGRES_PASSWORD: {{ db_password }}
  backend:
    build: .
    ports:
      - "{{ backend_port }}:{{ backend_port }}"
    env_file:
      - .env
    depends_on:
      - db
```

`tasks/main.yml`:
```yaml
# application directory
- name: Create backend directory
  ansible.builtin.file:
    path: /opt/backend
    state: directory

# firewall expose specified backend port
- name: Allow backend port
  community.general.ufw:
    rule: allow
    port: "{{ backend_port }}"
    proto: tcp

# transfers templates to target 
- name: Copy backend configuration files
  ansible.builtin.template:
    src: "{{ item.src }}"
    dest: "/opt/backend/{{ item.dest }}"
  loop:
    - { src: 'Dockerfile.j2', dest: 'Dockerfile' }
    - { src: 'docker-compose.yml.j2', dest: 'docker-compose.yml' }
    - { src: '.env.j2', dest: '.env' }

- name: Copy application source code
  ansible.builtin.copy:
    src: app/
    dest: /opt/backend/

- name: Start backend services with Docker Compose
  ansible.builtin.command:
    cmd: docker compose up -d --build
    chdir: /opt/backend

- name: Health check backend service
  ansible.builtin.uri:
    url: "http://localhost:{{ backend_port }}"
    method: GET
    status_code: 200
  register: result
  until: result.status == 200
  retries: 5
  delay: 10
```

Add these lines into `/site.yml`: 

```yaml
- name: Deploy Backend Service
  hosts: backend
  become: yes
  roles:
    - backend
```

---

## Praktikan 3: Prabaswara | Setup Frontend Proxy

### Step 1: Make Frontend Role

Command:

```bash 
mkdir -p roles/frontend/tasks
```

`roles/frontend/tasks/main.yml`:

```
---
- name: Create frontend deployment directory
  ansible.builtin.file:
    path: /opt/frontend
    state: directory

- name: Allow HTTP port through UFW
  community.general.ufw:
    rule: allow
    port: "80"
    proto: tcp

- name: Generate frontend Docker Compose payload
  ansible.builtin.copy:
    dest: /opt/frontend/docker-compose.yml
    content: |
      services:
        web:
          image: nginx:alpine
          ports:
            - "80:80"
          restart: always

- name: Start frontend services with Docker Compose
  ansible.builtin.command:
    cmd: docker compose up -d
    chdir: /opt/frontend
```

Added on `site.yml`:

```yaml
- name: Deploy Frontend Service
  hosts: frontend
  become: yes
  roles:
    - frontend
```

---

## End-toEnd Verification

Due to multipass utilizing dynamic DHCP allocation, IP Addresses may differ from one device to another. Here are our solutions to resolve that in each of our devices:

1. Discover Current IP Allocations:

    ```bash
    # Identify IPv4 addresses for `node1` and `node2`
    multipass list
    ```

    > [!NOTE]
    > Make sure Multipass on Windows Powershell is already connected to WSL2

2. Validate Backend Infrastructure: 

    ```bash
    curl http://<NODE1_IP>:3000
    ```

    > Expected output: `Backend Operational`

3. Validate Frontend Infrastructure:

    ```bash
    curl http://<NODE2_IP> 
    ```

    > Expected output: _Nginx Welcome HTML_

---

*Praktikum TKA 2026 — Modul 3 Ansible*
