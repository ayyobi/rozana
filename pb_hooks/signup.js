/**
 * Mode d'inscription de Rozana (chargé avec require() par rozana.pb.js :
 * dans PocketBase, chaque gestionnaire s'exécute isolé et ne voit pas les fonctions
 * déclarées au niveau du fichier).
 */
module.exports = {
  signupMode: () => {
    const mode = String($os.getenv('ROZANA_SIGNUP') || '').trim().toLowerCase();
    const code = String($os.getenv('ROZANA_INVITE_CODE') || '').trim();
    if (mode === 'closed') return { mode: 'closed', code: '' };
    if (mode === 'invite' || (mode === '' && code)) return { mode: code ? 'invite' : 'closed', code: code };
    return { mode: 'open', code: '' };
  },
};
