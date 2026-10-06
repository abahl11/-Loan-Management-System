const Session = {
    storageKey: 'loandesk.session',
    token: null,
    user: null,

    load() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.storageKey));
            if (saved) {
                this.token = saved.token;
                this.user = saved.user;
            }
        } catch (e) { }
    },

    save({ token, user }) {
        this.token = token;
        this.user = user;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({ token, user }));
        } catch (e) { }
    },

    clear() {
        this.token = null;
        this.user = null;
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) { }
    }
};

const Api = {
    onExpired: null,

    async call(path, { method = 'GET', body, form, raw = false } = {}) {
        const headers = {};
        if (Session.token) headers.Authorization = `Bearer ${Session.token}`;

        let payload;
        if (form) {
            payload = form;
        } else if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }

        const res = await fetch(`/api${path}`, { method, headers, body: payload });

        if (res.status === 401 && Session.token && this.onExpired) this.onExpired();
        if (raw && res.ok) return res;

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            let message = data.message || `Request failed (${res.status})`;
            if (data.details && data.details.length) {
                message += ': ' + data.details.map((d) => d.message).join(', ');
            }
            throw new Error(message);
        }
        return data;
    },

    async download(path, fallbackName) {
        const res = await this.call(path, { raw: true });
        const disposition = res.headers.get('Content-Disposition') || '';
        const found = disposition.match(/filename="?([^";]+)"?/);

        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = found ? found[1] : fallbackName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    }
};
