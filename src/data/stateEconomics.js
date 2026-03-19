/**
 * State-level economic data for map visualization
 * GDP, debt, population, and industry data
 */

export const STATE_ECONOMICS = {
  "AL": {
    name: "Alabama",
    gdp: 250.3, // $ billions
    debt: 9.2,  // $ billions
    population: 5024279,
    topIndustries: ["automotive", "aerospace", "agriculture"],
    gdpPerCapita: 49800,
    unemploymentRate: 2.8,
    agriculturalOutput: 6.5, // $ billions
    energyProduction: "coal, natural gas, nuclear"
  },
  "AK": {
    name: "Alaska",
    gdp: 58.2,
    debt: 5.8,
    population: 733391,
    topIndustries: ["oil & gas", "fishing", "tourism"],
    gdpPerCapita: 79400,
    unemploymentRate: 4.2,
    agriculturalOutput: 0.8,
    energyProduction: "oil, natural gas, renewables"
  },
  "AZ": {
    name: "Arizona",
    gdp: 428.7,
    debt: 14.3,
    population: 7151502,
    topIndustries: ["technology", "aerospace", "tourism"],
    gdpPerCapita: 59900,
    unemploymentRate: 3.1,
    agriculturalOutput: 4.2,
    energyProduction: "solar, nuclear, natural gas"
  },
  "AR": {
    name: "Arkansas",
    gdp: 150.9,
    debt: 4.8,
    population: 3011524,
    topIndustries: ["agriculture", "manufacturing", "retail"],
    gdpPerCapita: 50100,
    unemploymentRate: 3.0,
    agriculturalOutput: 16.8,
    energyProduction: "natural gas, coal, hydro"
  },
  "CA": {
    name: "California",
    gdp: 3800.5,
    debt: 152.7,
    population: 39538223,
    topIndustries: ["technology", "entertainment", "agriculture"],
    gdpPerCapita: 96100,
    unemploymentRate: 4.5,
    agriculturalOutput: 54.0,
    energyProduction: "solar, wind, natural gas, hydro"
  },
  "CO": {
    name: "Colorado",
    gdp: 432.8,
    debt: 15.2,
    population: 5773714,
    topIndustries: ["technology", "aerospace", "tourism"],
    gdpPerCapita: 74900,
    unemploymentRate: 3.3,
    agriculturalOutput: 8.5,
    energyProduction: "natural gas, wind, solar, coal"
  },
  "CT": {
    name: "Connecticut",
    gdp: 309.4,
    debt: 42.8,
    population: 3605944,
    topIndustries: ["finance", "insurance", "manufacturing"],
    gdpPerCapita: 85800,
    unemploymentRate: 3.8,
    agriculturalOutput: 1.2,
    energyProduction: "nuclear, natural gas, renewables"
  },
  "DE": {
    name: "Delaware",
    gdp: 86.5,
    debt: 6.2,
    population: 989948,
    topIndustries: ["finance", "chemicals", "agriculture"],
    gdpPerCapita: 87400,
    unemploymentRate: 3.5,
    agriculturalOutput: 1.5,
    energyProduction: "natural gas, solar, wind"
  },
  "FL": {
    name: "Florida",
    gdp: 1400.3,
    debt: 34.5,
    population: 21538187,
    topIndustries: ["tourism", "agriculture", "aerospace"],
    gdpPerCapita: 65000,
    unemploymentRate: 2.9,
    agriculturalOutput: 7.8,
    energyProduction: "natural gas, solar, nuclear"
  },
  "GA": {
    name: "Georgia",
    gdp: 712.8,
    debt: 18.9,
    population: 10711908,
    topIndustries: ["logistics", "technology", "agriculture"],
    gdpPerCapita: 66500,
    unemploymentRate: 3.0,
    agriculturalOutput: 13.5,
    energyProduction: "natural gas, nuclear, coal"
  },
  "HI": {
    name: "Hawaii",
    gdp: 98.2,
    debt: 9.8,
    population: 1455271,
    topIndustries: ["tourism", "military", "agriculture"],
    gdpPerCapita: 67500,
    unemploymentRate: 3.2,
    agriculturalOutput: 2.8,
    energyProduction: "oil, solar, wind, geothermal"
  },
  "ID": {
    name: "Idaho",
    gdp: 98.7,
    debt: 3.2,
    population: 1839106,
    topIndustries: ["agriculture", "technology", "manufacturing"],
    gdpPerCapita: 53700,
    unemploymentRate: 2.7,
    agriculturalOutput: 9.2,
    energyProduction: "hydro, natural gas, wind"
  },
  "IL": {
    name: "Illinois",
    gdp: 1020.5,
    debt: 52.3,
    population: 12812508,
    topIndustries: ["finance", "manufacturing", "agriculture"],
    gdpPerCapita: 79600,
    unemploymentRate: 4.1,
    agriculturalOutput: 19.5,
    energyProduction: "nuclear, coal, natural gas, renewables"
  },
  "IN": {
    name: "Indiana",
    gdp: 455.8,
    debt: 12.7,
    population: 6785528,
    topIndustries: ["manufacturing", "agriculture", "logistics"],
    gdpPerCapita: 67200,
    unemploymentRate: 3.2,
    agriculturalOutput: 11.8,
    energyProduction: "coal, natural gas, wind"
  },
  "IA": {
    name: "Iowa",
    gdp: 225.4,
    debt: 6.5,
    population: 3190369,
    topIndustries: ["agriculture", "manufacturing", "renewable energy"],
    gdpPerCapita: 70600,
    unemploymentRate: 2.6,
    agriculturalOutput: 35.2,
    energyProduction: "wind, ethanol, natural gas"
  },
  "KS": {
    name: "Kansas",
    gdp: 205.8,
    debt: 7.8,
    population: 2937880,
    topIndustries: ["agriculture", "aerospace", "energy"],
    gdpPerCapita: 70100,
    unemploymentRate: 2.8,
    agriculturalOutput: 18.5,
    energyProduction: "wind, natural gas, oil"
  },
  "KY": {
    name: "Kentucky",
    gdp: 245.6,
    debt: 14.2,
    population: 4505836,
    topIndustries: ["manufacturing", "agriculture", "energy"],
    gdpPerCapita: 54500,
    unemploymentRate: 3.9,
    agriculturalOutput: 6.8,
    energyProduction: "coal, natural gas, renewables"
  },
  "LA": {
    name: "Louisiana",
    gdp: 280.5,
    debt: 18.3,
    population: 4657757,
    topIndustries: ["oil & gas", "chemicals", "shipping"],
    gdpPerCapita: 60200,
    unemploymentRate: 3.5,
    agriculturalOutput: 3.2,
    energyProduction: "oil, natural gas, petrochemicals"
  },
  "ME": {
    name: "Maine",
    gdp: 78.5,
    debt: 4.2,
    population: 1362359,
    topIndustries: ["tourism", "forestry", "fishing"],
    gdpPerCapita: 57600,
    unemploymentRate: 3.1,
    agriculturalOutput: 1.8,
    energyProduction: "hydro, wind, natural gas"
  },
  "MD": {
    name: "Maryland",
    gdp: 480.2,
    debt: 19.8,
    population: 6177224,
    topIndustries: ["biotechnology", "defense", "tourism"],
    gdpPerCapita: 77700,
    unemploymentRate: 3.4,
    agriculturalOutput: 2.5,
    energyProduction: "nuclear, natural gas, renewables"
  },
  "MA": {
    name: "Massachusetts",
    gdp: 650.8,
    debt: 76.5,
    population: 7029917,
    topIndustries: ["technology", "education", "healthcare"],
    gdpPerCapita: 92600,
    unemploymentRate: 3.6,
    agriculturalOutput: 0.9,
    energyProduction: "natural gas, nuclear, renewables"
  },
  "MI": {
    name: "Michigan",
    gdp: 590.2,
    debt: 33.4,
    population: 10077331,
    topIndustries: ["automotive", "manufacturing", "technology"],
    gdpPerCapita: 58600,
    unemploymentRate: 4.0,
    agriculturalOutput: 10.5,
    energyProduction: "natural gas, nuclear, renewables"
  },
  "MN": {
    name: "Minnesota",
    gdp: 432.5,
    debt: 15.8,
    population: 5706494,
    topIndustries: ["healthcare", "manufacturing", "agriculture"],
    gdpPerCapita: 75800,
    unemploymentRate: 2.9,
    agriculturalOutput: 21.8,
    energyProduction: "wind, nuclear, coal, natural gas"
  },
  "MS": {
    name: "Mississippi",
    gdp: 130.8,
    debt: 6.5,
    population: 2961279,
    topIndustries: ["agriculture", "manufacturing", "tourism"],
    gdpPerCapita: 44200,
    unemploymentRate: 3.3,
    agriculturalOutput: 8.2,
    energyProduction: "natural gas, nuclear, coal"
  },
  "MO": {
    name: "Missouri",
    gdp: 380.2,
    debt: 14.8,
    population: 6154913,
    topIndustries: ["manufacturing", "agriculture", "tourism"],
    gdpPerCapita: 61800,
    unemploymentRate: 3.1,
    agriculturalOutput: 9.5,
    energyProduction: "coal, nuclear, natural gas"
  },
  "MT": {
    name: "Montana",
    gdp: 62.8,
    debt: 4.2,
    population: 1084225,
    topIndustries: ["agriculture", "mining", "tourism"],
    gdpPerCapita: 57900,
    unemploymentRate: 2.8,
    agriculturalOutput: 4.8,
    energyProduction: "coal, wind, hydro, natural gas"
  },
  "NE": {
    name: "Nebraska",
    gdp: 165.4,
    debt: 3.8,
    population: 1961504,
    topIndustries: ["agriculture", "insurance", "manufacturing"],
    gdpPerCapita: 84300,
    unemploymentRate: 2.4,
    agriculturalOutput: 25.8,
    energyProduction: "wind, nuclear, ethanol"
  },
  "NV": {
    name: "Nevada",
    gdp: 205.8,
    debt: 4.2,
    population: 3104614,
    topIndustries: ["tourism", "mining", "logistics"],
    gdpPerCapita: 66300,
    unemploymentRate: 4.8,
    agriculturalOutput: 0.9,
    energyProduction: "solar, natural gas, geothermal"
  },
  "NH": {
    name: "New Hampshire",
    gdp: 102.5,
    debt: 8.2,
    population: 1377529,
    topIndustries: ["manufacturing", "tourism", "technology"],
    gdpPerCapita: 74400,
    unemploymentRate: 2.6,
    agriculturalOutput: 0.8,
    energyProduction: "nuclear, natural gas, renewables"
  },
  "NJ": {
    name: "New Jersey",
    gdp: 720.8,
    debt: 46.2,
    population: 9288994,
    topIndustries: ["pharmaceuticals", "finance", "tourism"],
    gdpPerCapita: 77600,
    unemploymentRate: 3.9,
    agriculturalOutput: 1.2,
    energyProduction: "nuclear, natural gas, solar"
  },
  "NM": {
    name: "New Mexico",
    gdp: 115.8,
    debt: 6.8,
    population: 2117522,
    topIndustries: ["oil & gas", "tourism", "mining"],
    gdpPerCapita: 54700,
    unemploymentRate: 3.7,
    agriculturalOutput: 3.2,
    energyProduction: "oil, natural gas, solar, wind"
  },
  "NY": {
    name: "New York",
    gdp: 2100.5,
    debt: 142.8,
    population: 20201249,
    topIndustries: ["finance", "media", "tourism"],
    gdpPerCapita: 104000,
    unemploymentRate: 4.2,
    agriculturalOutput: 5.8,
    energyProduction: "natural gas, nuclear, hydro, renewables"
  },
  "NC": {
    name: "North Carolina",
    gdp: 680.5,
    debt: 18.2,
    population: 10439388,
    topIndustries: ["technology", "banking", "agriculture"],
    gdpPerCapita: 65200,
    unemploymentRate: 3.4,
    agriculturalOutput: 12.8,
    energyProduction: "nuclear, natural gas, solar, coal"
  },
  "ND": {
    name: "North Dakota",
    gdp: 68.5,
    debt: 2.8,
    population: 779094,
    topIndustries: ["oil & gas", "agriculture", "energy"],
    gdpPerCapita: 87900,
    unemploymentRate: 2.1,
    agriculturalOutput: 8.5,
    energyProduction: "oil, natural gas, wind, coal"
  },
  "OH": {
    name: "Ohio",
    gdp: 780.2,
    debt: 34.8,
    population: 11799448,
    topIndustries: ["manufacturing", "healthcare", "finance"],
    gdpPerCapita: 66100,
    unemploymentRate: 3.8,
    agriculturalOutput: 10.8,
    energyProduction: "natural gas, coal, nuclear, renewables"
  },
  "OK": {
    name: "Oklahoma",
    gdp: 225.8,
    debt: 8.5,
    population: 3959353,
    topIndustries: ["oil & gas", "aerospace", "agriculture"],
    gdpPerCapita: 57000,
    unemploymentRate: 3.0,
    agriculturalOutput: 7.8,
    energyProduction: "oil, natural gas, wind"
  },
  "OR": {
    name: "Oregon",
    gdp: 280.5,
    debt: 12.8,
    population: 4237256,
    topIndustries: ["technology", "forestry", "agriculture"],
    gdpPerCapita: 66200,
    unemploymentRate: 3.5,
    agriculturalOutput: 5.8,
    energyProduction: "hydro, wind, natural gas, solar"
  },
  "PA": {
    name: "Pennsylvania",
    gdp: 920.8,
    debt: 52.8,
    population: 13002700,
    topIndustries: ["energy", "manufacturing", "healthcare"],
    gdpPerCapita: 70800,
    unemploymentRate: 3.9,
    agriculturalOutput: 7.8,
    energyProduction: "natural gas, nuclear, coal, renewables"
  },
  "RI": {
    name: "Rhode Island",
    gdp: 68.5,
    debt: 9.2,
    population: 1097379,
    topIndustries: ["healthcare", "tourism", "manufacturing"],
    gdpPerCapita: 62400,
    unemploymentRate: 3.7,
    agriculturalOutput: 0.3,
    energyProduction: "natural gas, renewables"
  },
  "SC": {
    name: "South Carolina",
    gdp: 280.5,
    debt: 12.8,
    population: 5118425,
    topIndustries: ["manufacturing", "tourism", "agriculture"],
    gdpPerCapita: 54800,
    unemploymentRate: 3.2,
    agriculturalOutput: 4.2,
    energyProduction: "nuclear, natural gas, coal"
  },
  "SD": {
    name: "South Dakota",
    gdp: 62.8,
    debt: 3.2,
    population: 886667,
    topIndustries: ["agriculture", "tourism", "financial services"],
    gdpPerCapita: 70800,
    unemploymentRate: 2.3,
    agriculturalOutput: 10.8,
    energyProduction: "wind, ethanol, hydro, natural gas"
  },
  "TN": {
    name: "Tennessee",
    gdp: 450.8,
    debt: 12.5,
    population: 6910840,
    topIndustries: ["manufacturing", "healthcare", "tourism"],
    gdpPerCapita: 65200,
    unemploymentRate: 3.3,
    agriculturalOutput: 4.8,
    energyProduction: "nuclear, coal, natural gas, hydro"
  },
  "TX": {
    name: "Texas",
    gdp: 2200.5,
    debt: 58.2,
    population: 29145505,
    topIndustries: ["oil & gas", "technology", "aerospace"],
    gdpPerCapita: 75500,
    unemploymentRate: 3.6,
    agriculturalOutput: 25.8,
    energyProduction: "oil, natural gas, wind, solar"
  },
  "UT": {
    name: "Utah",
    gdp: 225.8,
    debt: 8.2,
    population: 3271616,
    topIndustries: ["technology", "mining", "tourism"],
    gdpPerCapita: 69000,
    unemploymentRate: 2.5,
    agriculturalOutput: 2.8,
    energyProduction: "coal, natural gas, solar, wind"
  },
  "VT": {
    name: "Vermont",
    gdp: 38.5,
    debt: 4.2,
    population: 643077,
    topIndustries: ["tourism", "manufacturing", "agriculture"],
    gdpPerCapita: 59900,
    unemploymentRate: 2.4,
    agriculturalOutput: 1.2,
    energyProduction: "hydro, wind, biomass, natural gas"
  },
  "VA": {
    name: "Virginia",
    gdp: 620.8,
    debt: 28.5,
    population: 8631393,
    topIndustries: ["defense", "technology", "agriculture"],
    gdpPerCapita: 71900,
    unemploymentRate: 2.9,
    agriculturalOutput: 4.5,
    energyProduction: "nuclear, natural gas, coal, renewables"
  },
  "WA": {
    name: "Washington",
    gdp: 720.5,
    debt: 22.8,
    population: 7705281,
    topIndustries: ["technology", "aerospace", "agriculture"],
    gdpPerCapita: 93500,
    unemploymentRate: 3.8,
    agriculturalOutput: 12.8,
    energyProduction: "hydro, nuclear, wind, natural gas"
  },
  "WV": {
    name: "West Virginia",
    gdp: 85.2,
    debt: 12.8,
    population: 1793716,
    topIndustries: ["energy", "chemicals", "tourism"],
    gdpPerCapita: 47500,
    unemploymentRate: 4.2,
    agriculturalOutput: 1.2,
    energyProduction: "coal, natural gas, renewables"
  },
  "WI": {
    name: "Wisconsin",
    gdp: 380.5,
    debt: 15.8,
    population: 5893718,
    topIndustries: ["manufacturing", "agriculture", "healthcare"],
    gdpPerCapita: 64500,
    unemploymentRate: 3.0,
    agriculturalOutput: 15.8,
    energyProduction: "coal, nuclear, natural gas, renewables"
  },
  "WY": {
    name: "Wyoming",
    gdp: 45.8,
    debt: 2.8,
    population: 576851,
    topIndustries: ["energy", "mining", "tourism"],
    gdpPerCapita: 79400,
    unemploymentRate: 3.1,
    agriculturalOutput: 2.5,
    energyProduction: "coal, natural gas, wind, oil"
  }
};
