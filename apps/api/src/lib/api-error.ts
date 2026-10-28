// Erreur métier traduite en HTTP par le middleware central ; son message doit être publiable au client.
export class ApiError extends Error {
  // Associe un message publiable au statut HTTP et au code métier de l'erreur.
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
