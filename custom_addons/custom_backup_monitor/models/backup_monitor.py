import os
import glob
import time
from datetime import datetime, timezone, timedelta

from odoo import models, api
from odoo.exceptions import AccessError

# Zona waktu WIB (UTC+7) untuk tampilan jam yang akrab bagi pengguna Indonesia.
WIB = timezone(timedelta(hours=7))


class BackupMonitor(models.TransientModel):
    """Helper baca-saja untuk dashboard Backup Monitor.
    Tidak menyimpan data — hanya membaca filesystem & statistik server.
    Semua operasi khusus Administrator (base.group_system)."""
    _name = 'backup.monitor'
    _description = 'Backup Monitor'

    # ── Util ──────────────────────────────────────────────────────────────────
    @api.model
    def _dir_backup(self):
        """Folder backup di server. Bisa di-override lewat System Parameter
        'custom_backup_monitor.dir' (default /opt/odoo/backups)."""
        return self.env['ir.config_parameter'].sudo().get_param(
            'custom_backup_monitor.dir', '/opt/odoo/backups')

    @api.model
    def _cek_admin(self):
        if not self.env.user.has_group('base.group_system'):
            raise AccessError("Hanya Administrator yang boleh membuka Backup Monitor.")

    @api.model
    def _human(self, n):
        """Ubah jumlah byte ke teks ramah (mis. 9.2 MB)."""
        n = float(n or 0)
        for unit in ('B', 'KB', 'MB', 'GB', 'TB'):
            if n < 1024 or unit == 'TB':
                return ("%d %s" % (int(n), unit)) if unit == 'B' else ("%.1f %s" % (n, unit))
            n /= 1024.0

    # ── Data dashboard ────────────────────────────────────────────────────────
    @api.model
    def get_dashboard(self):
        self._cek_admin()
        d = self._dir_backup()
        now = datetime.now(timezone.utc)
        res = {
            'backup_dir': d,
            'now_utc': now.strftime('%Y-%m-%d %H:%M:%S'),
            'now_wib': now.astimezone(WIB).strftime('%Y-%m-%d %H:%M:%S'),
            'files': [],
            'total_backup': '0 B',
            'status': 'none',          # none | ok | warn | stale
            'last_backup_wib': '',
            'umur_jam': None,
            'disk': {}, 'cpu': {}, 'ram': {},
            'log_tail': '',
        }

        # --- Daftar file backup ---
        files, total = [], 0
        try:
            for path in glob.glob(os.path.join(d, 'backup_*.tar.gz')):
                try:
                    st = os.stat(path)
                except OSError:
                    continue
                files.append({
                    'name': os.path.basename(path),
                    'size': self._human(st.st_size),
                    'size_bytes': st.st_size,
                    'mtime': st.st_mtime,
                    'time_wib': datetime.fromtimestamp(st.st_mtime, WIB).strftime('%Y-%m-%d %H:%M'),
                })
                total += st.st_size
            files.sort(key=lambda f: f['mtime'], reverse=True)
        except Exception:
            pass
        res['files'] = files
        res['total_backup'] = self._human(total)

        # --- Status (dari kesegaran file terbaru) ---
        if files:
            latest = files[0]
            umur = (time.time() - latest['mtime']) / 3600.0
            res['last_backup_wib'] = latest['time_wib']
            res['umur_jam'] = round(umur, 1)
            res['status'] = 'ok' if umur <= 26 else ('warn' if umur <= 50 else 'stale')

        # --- Penyimpanan (disk) ---
        try:
            import shutil
            target = d if os.path.isdir(d) else os.path.abspath(os.sep)
            du = shutil.disk_usage(target)
            res['disk'] = {
                'total': self._human(du.total),
                'used': self._human(du.used),
                'free': self._human(du.free),
                'percent': round(du.used * 100.0 / du.total, 1) if du.total else 0,
            }
        except Exception:
            pass

        # --- CPU (jumlah core + beban rata-rata) ---
        try:
            la = os.getloadavg()  # hanya tersedia di Linux/Unix
            res['cpu'] = {
                'count': os.cpu_count() or 0,
                'load1': round(la[0], 2), 'load5': round(la[1], 2), 'load15': round(la[2], 2),
            }
        except (OSError, AttributeError):
            res['cpu'] = {'count': os.cpu_count() or 0,
                          'load1': None, 'load5': None, 'load15': None}

        # --- RAM (dari /proc/meminfo, Linux) ---
        try:
            mem = {}
            with open('/proc/meminfo') as f:
                for line in f:
                    k, _, v = line.partition(':')
                    parts = v.strip().split()
                    if parts:
                        mem[k.strip()] = int(parts[0]) * 1024  # kB -> B
            total_ram = mem.get('MemTotal', 0)
            avail = mem.get('MemAvailable', mem.get('MemFree', 0))
            used = max(total_ram - avail, 0)
            if total_ram:
                res['ram'] = {
                    'total': self._human(total_ram),
                    'used': self._human(used),
                    'free': self._human(avail),
                    'percent': round(used * 100.0 / total_ram, 1),
                }
        except Exception:
            pass

        # --- Cuplikan cron.log (run otomatis terakhir) ---
        try:
            logp = os.path.join(d, 'cron.log')
            if os.path.isfile(logp):
                with open(logp, 'r', errors='replace') as f:
                    res['log_tail'] = ''.join(f.readlines()[-40:]).strip()
        except Exception:
            pass

        return res

    # ── Uji kecepatan disk ────────────────────────────────────────────────────
    @api.model
    def disk_speed_test(self):
        """Tulis & baca file sementara ~64MB untuk mengukur kecepatan disk server."""
        self._cek_admin()
        d = self._dir_backup()
        if not os.path.isdir(d):
            d = os.path.abspath(os.sep)
        path = os.path.join(d, '.speedtest.tmp')
        size_mb = 64
        chunk = b'\0' * (1024 * 1024)
        try:
            t0 = time.time()
            with open(path, 'wb') as f:
                for _ in range(size_mb):
                    f.write(chunk)
                f.flush()
                os.fsync(f.fileno())
            dt_w = time.time() - t0

            t0 = time.time()
            with open(path, 'rb') as f:
                while f.read(1024 * 1024):
                    pass
            dt_r = time.time() - t0

            return {
                'size_mb': size_mb,
                'write_mbps': round(size_mb / dt_w, 1) if dt_w > 0 else 0,
                'read_mbps': round(size_mb / dt_r, 1) if dt_r > 0 else 0,
            }
        finally:
            try:
                os.remove(path)
            except OSError:
                pass
