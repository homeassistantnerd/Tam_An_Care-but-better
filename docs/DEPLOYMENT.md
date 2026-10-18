# Hướng dẫn triển khai Tâm An Care

Hệ thống gồm 3 thành phần, đều chạy được bằng Docker Compose:

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| `postgres` | PostgreSQL 16 | Schema + migration khởi tạo tự động **khi volume dữ liệu còn trống** (`database/bootstrap.sh`) |
| `api` | NestJS (Node 22) | Cổng 3000, mọi route dưới `/api/...`, health: `/api/health/ready` |
| `web` / `frontend` | Nginx + bản build Vite (PWA) | Phục vụ SPA, proxy `/api/` sang `api:3000`, cấu hình runtime qua `/config.js` |

Có 3 cách chạy:

- **A. Phát triển cục bộ** (không Docker cho app) — sửa code hằng ngày.
- **B. Docker nhanh** (`docker-compose.yml`) — chạy thử/staging, có dữ liệu demo.
- **C. Production** (`deploy/production/`) — HTTPS, Docker secrets, backup hằng ngày.

Phần **D** dành cho việc nâng cấp một hệ thống **đang có dữ liệu** (ví dụ Production Test).

---

## Yêu cầu

- Debian 12 / Ubuntu 22.04+ (64-bit), 2 vCPU, RAM 4 GB, ổ SSD 15 GB trống.
- Docker Engine + Docker Compose plugin (cho B và C).
- Node.js ≥ 20 (khuyến nghị 22) và PostgreSQL 16 client (`psql`) cho A.

Cài Docker trên Debian:

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER" && newgrp docker
```

---

## A. Phát triển cục bộ

Mỗi workspace có lockfile riêng (để Docker build độc lập), nên cài với `--workspaces=false`:

```bash
git clone https://github.com/homeassistantnerd/Tam_An_Care-but-better.git tamancare
cd tamancare
npm ci --workspaces=false --prefix api
npm ci --workspaces=false --prefix frontend
cp api/.env.example api/.env        # sửa DATABASE_URL / JWT_SECRET nếu cần
```

Tạo database trống rồi khởi tạo schema + toàn bộ migration + dữ liệu demo:

```bash
createdb taman_care                                   # hoặc dùng: docker compose up -d postgres
PGHOST=localhost PGUSER=taman PGPASSWORD=... PGDATABASE=taman_care npm run db:bootstrap
DATABASE_URL=postgresql://taman:...@localhost:5432/taman_care npm run db:seed
```

Chạy:

```bash
npm run start:api        # http://localhost:3000  (Swagger: http://localhost:3000/docs, chỉ khi không phải production)
npm run start:frontend   # http://localhost:5173  (Vite proxy /api -> 127.0.0.1:3000)
```

Tài khoản demo (từ `database/seeds/001_demo_data.sql`, mật khẩu chung `TamAn@2026`):
`TA-DIR-01` (Ban Giám đốc), `TA-MGR-01` (Quản lý chăm sóc), `TA-NUR-01` (Điều dưỡng)… — **chỉ dùng cho môi trường thử**.

> Ở `NODE_ENV=development` API **không** kiểm tra JWT (middleware chỉ bật ở production); dùng để phát triển, không bao giờ mở ra Internet.

Kiểm thử:

```bash
npm run build          # build API + frontend
npm test               # unit/HTTP tests API + frontend + bộ hồi quy ops/ci (không cần DB)
npm run test:integration   # cần PostgreSQL 16 dùng-một-lần, xem scripts/ci-integration.sh
npm run security:audit
```

---

## B. Docker nhanh (thử nghiệm / staging)

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health/ready
```

- Web: `http://<máy-chủ>:5173` (đổi bằng `FRONTEND_PORT`), API trực tiếp: `:3000`, PostgreSQL: `:5432`.
- Lần đầu (volume trống) Postgres chạy `database/bootstrap.sh` rồi nạp dữ liệu demo.
- Nút chuyển vai trò nhanh bật bằng `TAMAN_ENABLE_DEV_SWITCHER: "true"` của service `frontend`.
- Mặc định `NODE_ENV=development`. Muốn thử đúng như production: đặt `NODE_ENV=production` và `CORS_ALLOWED_ORIGINS=http://<máy-chủ>:5173`.
- Xoá sạch để khởi tạo lại: `docker compose down -v` (**mất toàn bộ dữ liệu**).

---

## C. Production (máy chủ mới)

Toàn bộ cấu hình nằm ở `deploy/production/`: Postgres không mở cổng ra ngoài (mạng `backend` internal), API đọc bí mật từ Docker secrets, Nginx phục vụ HTTPS và proxy `/api/`, service `db-backup` sao lưu 02:00 mỗi ngày (giữ 14 ngày).

### 1. Lấy mã nguồn

```bash
sudo mkdir -p /opt/tamancare && sudo chown "$USER" /opt/tamancare
git clone https://github.com/homeassistantnerd/Tam_An_Care-but-better.git /opt/tamancare
cd /opt/tamancare
```

### 2. Tạo bí mật (không bao giờ commit)

```bash
cd deploy/production
mkdir -p secrets && chmod 700 secrets
DB_PASS="$(openssl rand -hex 24)"
printf '%s' "$DB_PASS" > secrets/postgres_password
printf 'postgresql://taman:%s@postgres:5432/taman_care' "$DB_PASS" > secrets/database_url
openssl rand -base64 48 | tr -d '\n' > secrets/jwt_secret      # >= 32 ký tự
chmod 600 secrets/*
unset DB_PASS
```

### 3. Cấu hình môi trường

```bash
cp .env.example .env
nano .env     # TAMANCARE_SERVER_NAME, CORS_ORIGIN=https://<tên-miền>, TAMANCARE_TLS_DIR, TAMANCARE_ACME_DIR
```

`POSTGRES_USER`/`POSTGRES_DB` trong `.env` phải khớp với `secrets/database_url`.
Các tính năng tài chính/hợp đồng **tắt mặc định**; muốn bật, thêm biến vào `environment:` của service `api` (xem bảng biến ở cuối).

### 4. Chứng chỉ TLS

Nginx cần `fullchain.pem` và `privkey.pem` trong `TAMANCARE_TLS_DIR`. Với Let's Encrypt (chạy trước khi bật stack, cổng 80 còn trống):

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d care.example.org
# TAMANCARE_TLS_DIR=/etc/letsencrypt/live/care.example.org
```

Gia hạn: `sudo certbot renew --webroot -w <TAMANCARE_ACME_DIR>` rồi `docker compose ... restart web`.

### 5. Khởi động

```bash
docker compose -f docker-compose.production.yml --env-file .env up -d --build
docker compose -f docker-compose.production.yml --env-file .env ps        # postgres, api, web: healthy
docker compose -f docker-compose.production.yml --env-file .env logs postgres | grep bootstrap   # "bootstrap: complete"
curl -fsS https://care.example.org/api/health/ready
```

### 6. Tạo tài khoản Ban Giám đốc đầu tiên

Chỉ chạy được khi bảng nhân viên còn trống; tạo 1 tài khoản `SUPERVISOR` kèm mật khẩu (≥ 12 ký tự):

```bash
docker compose -f docker-compose.production.yml --env-file .env exec \
  -e TAMANCARE_BOOTSTRAP_PASSWORD='<mật-khẩu-mạnh>' api \
  node dist/staff-actors/staff-bootstrap.js --actor-id=BGD-01 --staff-code=BGD-01 --display-name="Tên Giám đốc"
```

Đăng nhập web bằng `BGD-01`, sau đó tạo các tài khoản khác trong **Quản lý nhân sự & phân quyền**.
Không nạp `database/seeds/001_demo_data.sql` lên production.

### 7. Tường lửa

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

### Sao lưu & khôi phục

- Tự động: service `db-backup` chạy `ops/x3-production/backup/backup.sh` (pg_dump định dạng custom + manifest sha256) vào volume `tamancare_backups`.
- Thủ công: `docker compose ... exec db-backup sh -c 'DATABASE_URL="$(cat /run/secrets/database_url)" sh /scripts/backup.sh'`.
- Khôi phục / PITR / diễn tập: `ops/x3-production/backup/README.md`, `ops/x3-production/dr/RESTORE-RUNBOOK.md`, `ops/x3-production/dr/PITR-RUNBOOK.md`.

---

## D. Nâng cấp hệ thống đang có dữ liệu

`database/bootstrap.sh` **chỉ** dành cho database trống — migration không idempotent. Với DB đang chạy:

1. **Sao lưu trước** (`backup.sh` hoặc `pg_dump -Fc`) và kiểm tra file dump đọc lại được (`pg_restore --list`).
2. Cập nhật mã nguồn: `git pull origin main`.
3. Áp các migration **chưa có** trên DB đó, theo đúng thứ tự trong `database/bootstrap.sh`, mỗi file một lần:

   ```bash
   docker compose ... exec -T postgres psql -U taman -d taman_care -v ON_ERROR_STOP=1 < <file.sql>
   ```

   Kiểm tra một migration đã áp chưa bằng `\d <bảng>` / `SELECT to_regclass('public.<bảng>')`. Các migration mới trong đợt hợp nhất này:

   | File | Tác dụng | Ghi chú |
   |---|---|---|
   | `database/migrations/20261009_017_paper_records.sql` | Sổ hồ sơ giấy | |
   | `database/migrations/20261009_017_resident_meal_registrations.sql` | Đăng ký suất ăn theo cư dân | |
   | `database/migrations/20261018_018_production_schema_parity.sql` | Đồng bộ các đối tượng **đã có trên Production Test nhưng chưa từng được commit** (`finance_entries`, `notifications`, `psychological_assessments`, cột ngày sinh chỉ-năm, liên hệ nhân viên, ràng buộc 16 role) | Dùng `IF NOT EXISTS`; trên Production Test dự kiến không đổi gì — vẫn nên đối chiếu `\d` trước |
   | `database/rbac-migrations/20261016_001_resident_scope.up.sql` | Phân quyền theo cư dân cho GUARDIAN / PSYCHOLOGIST / SOCIAL_WORKER | Tự dừng nếu ràng buộc hiện tại khác dự kiến (schema drift) |
   | `api/migrations/001_resident_demographic_audit.sql` | Nhật ký sửa ngày sinh | |
   | `ops/finance/v22…v32` (001 → 010) | Hoá đơn, phiếu thu, phân bổ, hợp đồng, bảng giá | **Chưa được phê duyệt cho Production Test** (`docs/finance/`); 007 tự dừng nếu đã có dữ liệu billing |

4. Build & khởi động lại: `docker compose ... up -d --build`, kiểm tra `/api/health/ready` và đăng nhập.
5. Rollback: dựng lại image commit trước (`git checkout <commit> && docker compose ... up -d --build`); với schema, khôi phục từ bản sao lưu ở bước 1.

Quy trình phát hành thủ công và phạm vi được phép: `docs/RELEASE_GOVERNANCE.md`.

---

## Biến môi trường

### API (`api`)

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `NODE_ENV` | | `production` bật xác thực JWT bắt buộc, tắt Swagger, cấm tự tạo bảng lúc chạy |
| `PORT` | | Mặc định `3000` |
| `DATABASE_URL` / `DATABASE_URL_FILE` | ✔ (prod) | Chuỗi kết nối; hoặc `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` |
| `JWT_SECRET` / `JWT_SECRET_FILE` | ✔ (prod) | ≥ 32 ký tự |
| `CORS_ALLOWED_ORIGINS` hoặc `CORS_ORIGIN` | ✔ (prod) | Danh sách origin, cách nhau dấu phẩy |
| `RATE_LIMIT_PER_MINUTE` | | Mặc định `600` |
| `ENABLE_SWAGGER` | | `true` để bật `/docs` ở production |
| `TAMANCARE_FINANCE_READ_ROLES`, `TAMANCARE_FINANCE_CENTERWIDE_READ_ROLES`, `TAMANCARE_FINANCE_PAYROLL_READ_ROLES` | | Role được đọc dữ liệu tài chính (trống = không ai) |
| `TAMANCARE_FINANCE_WRITE_ENABLED`, `TAMANCARE_FINANCE_WRITE_ROLES` | | Bật ghi phân bổ thanh toán |
| `TAMANCARE_CONTRACT_READ_ROLES` | | Role đọc hợp đồng chuẩn |
| `TAMANCARE_CONTRACT_DRAFT_WRITE_ENABLED`, `TAMANCARE_CONTRACT_DRAFT_WRITE_ROLES` | | Bật soạn thảo hợp đồng |
| `TAMANCARE_CONTRACT_SIGNOFF_ENABLED`, `TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES`, `TAMANCARE_CONTRACT_APPROVER_ROLES`, `TAMANCARE_CONTRACT_ARCHIVE_ROOT` | | Bật xác minh chữ ký / phê duyệt hợp đồng, thư mục lưu PDF đã ký |
| `TAMANCARE_BOOTSTRAP_PASSWORD` / `_FILE` | | Chỉ dùng cho `staff-bootstrap.js` |

Báo cáo lãi/lỗ tháng chỉ dành cho `ADMIN` và `SUPERVISOR`, bất kể cấu hình.

### Frontend (container Nginx)

| Biến | Mô tả |
|---|---|
| `API_UPSTREAM_URL` | Địa chỉ API mà Nginx proxy `/api/` tới (mặc định `http://api:3000`) |
| `TAMAN_API_BASE_URL` | Ghi vào `/config.js`; để trống khi web và API cùng origin (khuyến nghị) |
| `TAMAN_ENABLE_DEV_SWITCHER` | `true` hiện bảng chuyển vai trò nhanh (chỉ môi trường thử) |

---

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| API thoát ngay với `relation "…" does not exist` | DB thiếu migration (production không tự tạo bảng) — xem mục D |
| API thoát với `CORS_ALLOWED_ORIGINS or CORS_ORIGIN is required` | Thiếu biến CORS ở production |
| Đăng nhập trả 401 dù đúng mật khẩu | Tài khoản bị khoá tạm sau nhiều lần sai, hoặc trạng thái khác `ACTIVE` |
| Mọi request trả 401 sau khi đổi role/khoá tài khoản | Đúng thiết kế: phiên cấp trước lần sửa tài khoản bị vô hiệu, cần đăng nhập lại |
| Trình duyệt vẫn chạy bản cũ | Kiểm tra `/sw.js`, `/index.html` trả `Cache-Control: no-cache` (cấu hình Nginx) |
| Postgres không chạy `bootstrap` | Volume đã có dữ liệu — bootstrap chỉ chạy lần đầu |
