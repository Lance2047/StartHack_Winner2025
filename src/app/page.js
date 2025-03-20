import Image from "next/image";
import { supabase } from "@/lib/supabase"; // Import Supabase client
import Navbar from "./components/Navbar";

const APIkey = process.env.CE_HISTORICAL_API_KEY

const getAPIFieldData = async (imLongitude, imLatitude, imStartDate, imEndDate) =>
    new Promise(async(resolve, reject) => {

        const requestPayload = {
            units: {
                temperature: "C",
                velocity: "km/h",
                length: "metric",
                energy: "watts"
            },
            geometry: {
                type: "Point",
                coordinates: [imLongitude , imLatitude, 0 ] 
            },
            format: "json",
            timeIntervals: [
                imStartDate + "T00:00+00+00/" + imEndDate + "T01:00+00+00"
            ],
            queries: [{
                domain: "ERA5T",
                gapFillDomain: null,
                timeResolution: "daily",
                codes: [
                    { code: 11, level: "2 m above gnd", aggregation: "mean" },  // Temp
                    { code: 11, level: "2 m above gnd", aggregation: "min" },   // Temp
                    { code: 11, level: "2 m above gnd", aggregation: "max" },    // Temp
                    { code: 85, level: "0-7 cm down", aggregation: "mean" },   // Soil Temp
                    { code: 61, level: "sfc", aggregation: "sum" },   // Precipation    
                    { code: 261, level: "sfc" },  // Evaporation    
                    { code: 144, level: "0-7 cm down", aggregation: "mean" },  // Soil moisture            
                ],
                transformations: [
                    {
                        type: "aggregateMonthly",
                        aggregation: "mean"
                    }
                ]
            },
            /*{
                domain: "WISE30",
                gapFillDomain: null,
                timeResolution: "daily",
                codes: [
                    //{ code: 812, level: "0 cm", aggregation: "mean"}          
                    { code: 817, level: "0-20 cm", aggregation: "mean"}
                ],
                transformations: [
                    {
                        type: "aggregateMonthly",
                        aggregation: "mean"
                    }
                ]
            }*/
        ]}
        
        const result = await fetch("http://my.meteoblue.com/dataset/query?apikey=" + APIkey, {
            method: "Post",
            headers: {
               'Content-Type': "application/json"
            },
            body: JSON.stringify(requestPayload)  
        });
        
        resolve(await result.json());
});

const getFieldData = async (imLongitude, imLatitude, imTargetMonth) =>
    new Promise(async(resolve, reject) => {
        
      const { data, error } = await supabase
          .from("Field")
          .select()
          .eq("longitude", imLongitude)
          .eq("latitude", imLatitude)
          .eq("month", imTargetMonth)
          .eq("year", "2024")
          .limit(1);

      if (data === null || data.length == 0) { // if data is not yet in database

          const rawData = await getAPIFieldData(imLongitude, imLatitude, "2024-01-01", "2024-12-31")

          // lets reformat data into database ready 
          let dataToBeInserted = []
          for (let i = 0; i < rawData[0].timeIntervals[0].length; i++) {
              
              dataToBeInserted.push( {
                  longitude: imLongitude,
                  latitude: imLatitude,
                  month: i + 1,
                  year:  "2024",
                  temp_min:  Math.round(rawData[0].codes[0].dataPerTimeInterval[0].data[0][i]),
                  temp_max:  Math.round(rawData[0].codes[1].dataPerTimeInterval[0].data[0][i]),
                  temp_avg: Math.round(rawData[0].codes[2].dataPerTimeInterval[0].data[0][i]),
                  soil_temp_avg: Math.round(rawData[0].codes[3].dataPerTimeInterval[0].data[0][i]),
                  precipitation: Math.round(rawData[0].codes[4].dataPerTimeInterval[0].data[0][i]),
                  evaporation: Math.round(rawData[0].codes[5].dataPerTimeInterval[0].data[0][i]),
                  soil_moisture: Math.round(rawData[0].codes[5].dataPerTimeInterval[0].data[0][i])
                  //nitrogen: rawData[0].codes[0].data[0][0],
                  //ph: rawData[0].codes[0].data[0][0]
              });
                            
              const { error } = await supabase
                  .from('Field')
                  .insert(dataToBeInserted);
              
              if (error) {
                  console.log("Database Error Occured" + error);
                  reject();
              } else {
                  
                const { insertedData, error } = await supabase
                  .from("Field")
                  .select()
                  .eq("longitude", imLongitude)
                  .eq("latitude", imLatitude)
                  .eq("month", imTargetMonth)
                  .eq("year", "2024")
                  .limit(1);
                
                if (error) {
                  console.log("Database Select after insert Error Occured" + error);
                  reject();
                } else {
                  resolve(insertedData)
                }
              }
          }
      } else {
          resolve(data);
      }
});

const getCropData = async (imCropName) =>
    new Promise(async(resolve, reject) => {

      const { data, error } = await supabase
        .from("Crop")
        .select()
        .eq("label", imCropName)
        .limit(1);

      if (error) {
        reject("Failed to read crop data from database")
      } else {
        resolve(data)
      }
});

// Service functions for front-end
const getAllCrops = async () =>
  new Promise(async(resolve, reject) => {
    
    const { data, error } = await supabase
      .from("Crop")
      .select('label')
    console.log(data)
    return data;
  });

export default async function Home() {
    
  const fieldData = await getFieldData(10, 50, 5);
  const cropData = await getCropData("CORN");
  
  console.log(JSON.stringify(cropData))
  // DO NOT CHANGE THIS FILE
  return;
}
