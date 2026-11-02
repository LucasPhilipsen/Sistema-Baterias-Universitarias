export class HealthController {
  getStatus(_req, res) {
    res.json({ status: 'ok', service: 'baterias-api' });
  }
}
