export const parseWaNumber = (jid) => {
    // JID: 573054489598@s.whatsapp.net  |  265154151366733@lid  |  5730...@g.us
    const raw = jid.split('@')[0];      // -> 573054489598
    return raw.startsWith('+') ? raw : `+${raw}`;
};
