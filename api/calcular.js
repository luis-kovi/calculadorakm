// api/calcular.js - Sua nova API na Vercel

export default async function handler(request, response) {
  // --- Configurações ---
  const franquia = 42; // km
  const precoKmAdicional = 1.5; // R$

  // 🔑 As chaves de API agora vêm das "Environment Variables" da Vercel
  const routeToken = process.env.OPEN_ROUTE_TOKEN;
  const cageToken = process.env.OPEN_CAGE_TOKEN;

  // Validação de tokens
  if (!routeToken || !cageToken) {
    return response.status(500).json({ error: "Tokens de API não configurados no servidor." });
  }

  // Pega os parâmetros da URL (ex: /api/calcular?origem=...&destino=...)
  const { origem: origemStr, destino: destinoStr } = request.query;

  // Validação de entradas
  if (!origemStr || !destinoStr) {
    return response.status(400).json({ error: '❌ Preencha todos os campos' });
  }

  const origemCoords = origemStr.match(/-?\d+\.\d+/g);
  const destinoCoords = destinoStr.split(',');
  if (!origemCoords || origemCoords.length !== 2 || destinoCoords.length !== 2) {
    return response.status(400).json({ error: '❌ Coordenadas inválidas.' });
  }

  const [latOrigem, lonOrigem] = origemCoords.map(parseFloat);
  const [latDestino, lonDestino] = destinoCoords.map(parseFloat);

  let resultado = { endereco: "", distanciaHtml: "", error: "" };

  // Etapa 1: Geocodificação reversa (OpenCage) - usando fetch
  try {
    const geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${latOrigem}+${lonOrigem}&key=${cageToken}&language=pt-br`;
    const geocodeResp = await fetch(geocodeUrl);
    const geocodeData = await geocodeResp.json();

    if (geocodeResp.ok) {
      resultado.endereco = geocodeData.results?.[0]?.formatted ?? "Endereço da origem não encontrado";
    } else {
      resultado.endereco = `Erro no OpenCage: ${geocodeResp.status}`;
    }
  } catch (e) {
    resultado.endereco = "❌ Falha ao obter endereço: " + e.message;
  }

  // Etapa 2: Cálculo de rota (OpenRouteService) - usando fetch
  try {
    const payload = { coordinates: [[lonOrigem, latOrigem], [lonDestino, latDestino]] };
    const routeResp = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: {
        'Authorization': routeToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const routeData = await routeResp.json();

    if (routeResp.ok) {
      const kmIda = routeData.routes[0].summary.distance / 1000;
      const kmTotal = kmIda * 2;
      const excedente = Math.max(0, kmTotal - franquia);
      const custo = excedente * precoKmAdicional;

      resultado.distanciaHtml = 
        `📍 Distância (ida): <b>${kmIda.toFixed(2)} km</b><br>` +
        `🔄 Total (ida e volta): <b>${kmTotal.toFixed(2)} km</b><br>` +
        `🎯 Excedente: <b>${excedente.toFixed(2)} km</b><br>` +
        `💰 Custo extra: <b>R$ ${custo.toFixed(2)}</b>`;
    } else {
      resultado.error = `❌ Erro na rota: ${routeData.error?.message || routeResp.status}`;
    }
  } catch (e) {
    resultado.error = "❌ Falha ao calcular rota: " + e.message;
  }

  // Envia a resposta final como JSON
  response.status(200).json(resultado);
}
