type FirebaseLikeError = {
  code?: string
}

export function getAuthErrorMessage(error: unknown, fallbackMessage: string) {
  const code = (error as FirebaseLikeError | null)?.code

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Hibás email cím vagy jelszó.'
    case 'auth/email-already-in-use':
      return 'Ez az email cím már regisztrált.'
    case 'auth/popup-blocked':
      return 'A böngésző letiltotta a Google bejelentkezési ablakot. Engedélyezd a popupot, majd próbáld újra.'
    case 'auth/popup-closed-by-user':
      return 'A Google bejelentkezési ablak bezárult a folyamat befejezése előtt.'
    case 'auth/cancelled-popup-request':
      return 'Már folyamatban van egy Google bejelentkezés. Várj egy pillanatot, majd próbáld újra.'
    case 'auth/unauthorized-domain':
      return 'Ez a domain még nincs engedélyezve a Firebase Authentication beállításainál.'
    default:
      return fallbackMessage
  }
}
