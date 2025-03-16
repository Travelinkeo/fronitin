import { useState } from 'react';
import axios from 'axios';

export default function App() {
  // Estados para el traductor de itinerarios
  const [itinerary, setItinerary] = useState('');
  const [output, setOutput] = useState('');
  const [selectedSystem, setSelectedSystem] = useState('SABRE');

  // Estados para la calculadora del valor del boleto
  const [cantidad1, setCantidad1] = useState('');
  const [cantidad2, setCantidad2] = useState('');
  const [cantidad3, setCantidad3] = useState('');
  const [porcentaje, setPorcentaje] = useState('');
  const [resultadoCalculadora, setResultadoCalculadora] = useState('');

  // Función para procesar el itinerario
  const parseItinerary = async () => {
    try {
      // Obtener datos de aerolíneas y aeropuertos desde el backend
      const airlinesResponse = await axios.get('http://localhost:5000/itinerary/airlines');
      const airportsResponse = await axios.get('http://localhost:5000/itinerary/airports');

      const airlinesData = airlinesResponse.data.reduce((acc, airline) => {
        acc[airline.code] = airline.name;
        return acc;
      }, {});

      const airportsData = airportsResponse.data.reduce((acc, airport) => {
        acc[airport.code] = airport.name;
        return acc;
      }, {});

      // Procesar el itinerario según el sistema seleccionado
      let output = '';
      if (selectedSystem === 'SABRE') {
        output = parseSabre(itinerary, airlinesData, airportsData);
      } else if (selectedSystem === 'Amadeus') {
        output = parseAmadeus(itinerary, airlinesData, airportsData);
      } else if (selectedSystem === 'KIU') {
        output = parseKiu(itinerary, airlinesData, airportsData);
      }
      setOutput(output);
    } catch (error) {
      console.error('Error al procesar el itinerario:', error);
      setOutput('<div class="error">Error al conectar con el servidor.</div>');
    }
  };

  // Función para calcular el valor del boleto
  const calcularMonto = () => {
    const cant1 = parseFloat(cantidad1);
    const cant2 = parseFloat(cantidad2);
    const cant3 = parseFloat(cantidad3);
    const pct = parseFloat(porcentaje);

    if (isNaN(cant1) || isNaN(cant2) || isNaN(cant3) || isNaN(pct)) {
      alert('Por favor, ingresa valores válidos.');
      return;
    }

    const sumaTotal = cant1 + cant2 + cant3;
    const montoPorcentaje = sumaTotal * (pct / 100);
    const montoFinal = sumaTotal + montoPorcentaje;

    setResultadoCalculadora(`Costo USD-$: ${montoFinal.toFixed(2)}`);
  };

  // Función para copiar el itinerario y el monto final al portapapeles
  const copiarAlPortapapeles = () => {
    // Extraer solo el texto plano del HTML
    const parser = new DOMParser();
    const textoACopiar = `${parser.parseFromString(output, 'text/html').body.textContent || ''}\n\n${resultadoCalculadora}`;
    
    // Copiar al portapapeles
    navigator.clipboard
      .writeText(textoACopiar)
      .then(() => {
        alert('¡Texto copiado al portapapeles!');
      })
      .catch((error) => {
        console.error('Error al copiar al portapapeles:', error);
        alert('Ocurrió un error al copiar el texto. Por favor, inténtalo de nuevo.');
      });
  };

  // Funciones auxiliares para formatear fechas y horas
  const formatDate = (dateStr) => {
    const months = {
      JAN: 'enero', FEB: 'febrero', MAR: 'marzo', APR: 'abril',
      MAY: 'mayo', JUN: 'junio', JUL: 'julio', AUG: 'agosto',
      SEP: 'septiembre', OCT: 'octubre', NOV: 'noviembre', DEC: 'diciembre'
    };
    const day = dateStr.slice(0, 2);
    const monthCode = dateStr.slice(2, 5).toUpperCase();
    return `${day} de ${months[monthCode] || monthCode}`;
  };

  const formatTime = (timeStr) => {
    return timeStr.replace(/(\d{2})(\d{2})(\+\d)?/, "$1:$2");
  };

  // Funciones para parsear itinerarios
  const parseSabre = (itinerary, airlinesData, airportsData) => {
    const flights = itinerary.split('\n').filter(line => line.trim() !== '');
    let output = '';

    flights.forEach(flight => {
        const match = flight.match(/^\s*(\d+)\s*([A-Z0-9]{2})\s*(\d+\s*[A-Z]*)\s+(\d{2}[A-Z]{3})\s+\w\s+(\w{3})(\w{3})\s+.*?\s+(\d{4})\s+(\d{4})(\d{2}[A-Z]{3})?.*/);
      if (!match) {
        output += `<div class="error">Error: Formato incorrecto en la línea "${flight}".</div>`;
        return;
      }

      const airlineCode = match[2];
      const flightNumber = match[3];
      const departureDate = formatDate(match[4]);
      const origin = airportsData[match[5]] || match[5];
      const destination = airportsData[match[6]] || match[6];
      const departureTime = formatTime(match[7]);
      const arrivalTime = formatTime(match[8]);
      const arrivalDate = match[9] ? formatDate(match[9]) : departureDate;
      const arrivalDateOffset = arrivalDate !== departureDate ? ` (día siguiente)` : '';

      output += `
        <div class="result">
          Vuelo <strong>${airlineCode} ${flightNumber}</strong>,
          Aerolínea: <strong>${airlinesData[airlineCode] || "Código desconocido (" + airlineCode + ")"}</strong><br>
          Fecha de salida: ${departureDate}, 
          Hora de salida: ${departureTime}<br>
          Fecha de llegada: ${arrivalDate}${arrivalDateOffset}, 
          Hora de llegada: ${arrivalTime}<br>
          Ruta: ${origin} → ${destination}<br><br>
        </div>
      `;
    });

    return output;
  };

  const parseAmadeus = (itinerary, airlinesData, airportsData) => {
    const flights = itinerary.split('\n').filter(line => line.trim() !== '');
    let output = '';

    flights.forEach(flight => {
        const match = flight.match(/^\s*(\d+)\s*([A-Z]{2})\s*(\d+[A-Z]*)\s+([A-Z])\s+([A-Z0-9]{5})\s+\w\s+(\w{3})(\w{3})\s+\S+(?:\s+\d+)?\s+(\d{4})\s+(\d{4})(?:\+(\d))?.*/);
      if (!match) {
        output += `<div class="error">Error: Formato incorrecto en la línea "${flight}".</div>`;
        return;
      }

      const airlineCode = match[2];
      const flightNumber = match[3];
      const departureDate = formatDate(match[5]);
      const origin = airportsData[match[6]] || match[6];
      const destination = airportsData[match[7]] || match[7];
      const departureTime = formatTime(match[8]);
      const arrivalTime = formatTime(match[9]);
      const hasPlusOne = match[10];
      const arrivalDateOffset = hasPlusOne ? ` (día siguiente)` : '';

      output += `
        <div class="result">
          Vuelo <strong>${airlineCode} ${flightNumber}</strong>, 
          Aerolínea: <strong>${airlinesData[airlineCode] || "Código desconocido (" + airlineCode + ")"}</strong><br>
          Fecha de salida: ${departureDate},
          Hora de salida: ${departureTime}<br>
          Fecha de llegada: ${departureDate}${arrivalDateOffset},
          Hora de llegada: ${arrivalTime}<br>
          Ruta: ${origin} → ${destination}<br><br>
        </div>
      `;
    });

    return output;
  };

  const parseKiu = (itinerary, airlinesData, airportsData) => {
    const flights = itinerary.split('\n').filter(line => line.trim() !== '');
    let output = '';

    flights.forEach(flight => {
        const match = flight.match(/^\s*(\d+)\s+([A-Z0-9]{2})\s*(\d+\s*[A-Z]*)\s+(\d{2}[A-Z]{3})\s+\w{2}\s+(\w{3})(\w{3})\s+.*?\s+(\d{4})\s+(\d{4})(\d{2}[A-Z]{3})?.*/);
      if (!match) {
        output += `<div class="error">Error: Formato incorrecto en la línea "${flight}".</div>`;
        return;
      }

      const airlineCode = match[2].trim();
      const flightNumber = match[3].replace(/\s+/g, '');
      const departureDate = formatDate(match[4]);
      const origin = airportsData[match[5]] || match[5];
      const destination = airportsData[match[6]] || match[6];
      const departureTime = formatTime(match[7]);
      const arrivalTime = formatTime(match[8]);
      const arrivalDate = match[9] ? formatDate(match[9]) : departureDate;
      const arrivalDateOffset = arrivalDate !== departureDate ? ` (día siguiente)` : '';

      output += `
        <div class="result">
          Vuelo <strong>${airlineCode} ${flightNumber}</strong>,
          Aerolínea: <strong>${airlinesData[airlineCode] || "Código desconocido (" + airlineCode + ")"}</strong><br>
          Fecha de salida: ${departureDate}, 
          Hora de salida: ${departureTime}<br>
          Fecha de llegada: ${arrivalDate}${arrivalDateOffset},
          Hora de llegada: ${arrivalTime}<br>
          Ruta: ${origin} → ${destination}<br><br>
        </div>
      `;
    });

    return output;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Traductor de Itinerarios */}
      <h1>Traductor de Itinerarios Aéreos</h1>
      <select
        value={selectedSystem}
        onChange={(e) => setSelectedSystem(e.target.value)}
        style={{
          padding: '10px',
          marginBottom: '10px',
          border: '1px solid #ccc',
          borderRadius: '5px',
        }}
      >
        <option value="SABRE">SABRE</option>
        <option value="Amadeus">Amadeus</option>
        <option value="KIU">KIU</option>
      </select>
      <textarea
        value={itinerary}
        onChange={(e) => setItinerary(e.target.value)}
        placeholder="Pega tu itinerario aquí..."
        rows="10"
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '10px',
          border: '1px solid #ccc',
          borderRadius: '5px',
        }}
      />
      <button
        onClick={parseItinerary}
        style={{
          padding: '10px 20px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Traducir
      </button>
      <div
        dangerouslySetInnerHTML={{ __html: output }}
        style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '5px',
        }}
      />

      {/* Calculador del Valor del Boleto */}
      <h1 style={{ marginTop: '40px' }}>Calculador del Valor del Boleto</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="number"
          value={cantidad1}
          onChange={(e) => setCantidad1(e.target.value)}
          placeholder="Tarifa"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        />
        <input
          type="number"
          value={cantidad2}
          onChange={(e) => setCantidad2(e.target.value)}
          placeholder="FEE Consolidador"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        />
        <input
          type="number"
          value={cantidad3}
          onChange={(e) => setCantidad3(e.target.value)}
          placeholder="FEE Interno"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        />
        <input
          type="number"
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
          placeholder="Porcentaje (%)"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        />
        <button
          onClick={calcularMonto}
          style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Calcular
        </button>
        <div
          style={{
            marginTop: '10px',
            padding: '10px',
            background: '#e9ecef',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontWeight: 'bold',
          }}
        >
          {resultadoCalculadora}
        </div>
      </div>

      {/* Botón para copiar resultados */}
      <button
        onClick={copiarAlPortapapeles}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          background: '#ffc107',
          color: 'black',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        Copiar Resultados al Portapapeles
      </button>
    </div>
  );
}