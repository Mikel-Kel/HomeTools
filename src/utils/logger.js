const isDev = import.meta.env.DEV;
export const log = {
    debug: (...args) => {
        if (isDev)
            console.debug(...args);
    },
    info: (...args) => {
        if (isDev)
            console.info(...args);
    },
    warn: (...args) => {
        if (isDev)
            console.warn(...args);
    },
    error: (...args) => {
        console.error(...args); // toujours visible
    },
};
