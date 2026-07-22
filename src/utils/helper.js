require('dotenv').config()
const fs = require('fs').promises;
const path = require('path');

async function getIpDetails(ip) {
    if (!ip) {
        console.log('🔍 getIpDetails: No IP provided');
        return
    }
    
    console.log('🔍 getIpDetails: Fetching location data for IP:', ip);
    
    try {
        console.log('🔍 getIpDetails: Making API request to ipregistry.co...');
        // Using ipregistry.co API with the working API key
        const response = await fetch(`https://api.ipregistry.co/${ip}?key=ira_S2alXDcCH6PF2wwwOb1xDXS1OY52VV0vfEx1`);
        
        console.log('🔍 getIpDetails: API Response status:', response.status);
        console.log('🔍 getIpDetails: API Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔍 getIpDetails: Complete API Response from ipregistry.co:', JSON.stringify(result, null, 2));
        
        // Extract the most relevant fields for our use case
        const locationData = result.location || {};
        const connectionData = result.connection || {};
        const companyData = result.company || {};
        
        console.log('🔍 getIpDetails: Extracted location data:', {
            city: locationData.city,
            region: locationData.region?.name,
            region_code: locationData.region?.code,
            country: locationData.country?.name,
            country_code: locationData.country?.code,
            postal: locationData.postal,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timezone: result.time_zone?.id,
            isp: connectionData.organization,
            asn: connectionData.asn,
            company_name: companyData.name,
            company_domain: companyData.domain
        });

        // Map ipregistry.co response to our expected format
        const processedResult = {
            city: locationData.city || "",
            region_name: locationData.region?.name || "",
            country_name: locationData.country?.name || "",
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timezone: result.time_zone?.id,
            postal: locationData.postal,
            org: connectionData.organization || companyData.name || "",
            asn: connectionData.asn,
            // Additional detailed information
            hostname: result.hostname,
            isp: connectionData.organization,
            company_domain: companyData.domain,
            connection_type: connectionData.type,
            security_info: {
                is_proxy: result.security?.is_proxy || false,
                is_vpn: result.security?.is_vpn || false,
                is_tor: result.security?.is_tor || false,
                is_cloud_provider: result.security?.is_cloud_provider || false
            }
        };
        
        console.log('🔍 getIpDetails: Processed result being returned:', JSON.stringify(processedResult, null, 2));
        
        return processedResult;
    } catch (error) {
        console.error('❌ getIpDetails: Error fetching location data:', error);
        console.error('❌ getIpDetails: Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        // Fallback to ipapi.co if ipregistry.co fails
        console.log('🔄 getIpDetails: Trying fallback to ipapi.co...');
        try {
            const fallbackResponse = await fetch(`https://ipapi.co/${ip}/json/`);
            if (fallbackResponse.ok) {
                const fallbackResult = await fallbackResponse.json();
                console.log('🔍 getIpDetails: Fallback API Response from ipapi.co:', JSON.stringify(fallbackResult, null, 2));
                
                const fallbackProcessed = {
                    city: fallbackResult.city || "",
                    region_name: fallbackResult.region || "",
                    country_name: fallbackResult.country_name || fallbackResult.country || "",
                    latitude: fallbackResult.latitude,
                    longitude: fallbackResult.longitude,
                    timezone: fallbackResult.timezone,
                    postal: fallbackResult.postal,
                    org: fallbackResult.org,
                    asn: fallbackResult.asn
                };
                
                console.log('🔍 getIpDetails: Fallback processed result:', JSON.stringify(fallbackProcessed, null, 2));
                return fallbackProcessed;
            }
        } catch (fallbackError) {
            console.error('❌ getIpDetails: Fallback also failed:', fallbackError);
            
            // Final fallback to ip-api.com
            console.log('🔄 getIpDetails: Trying final fallback to ip-api.com...');
            try {
                const finalFallbackResponse = await fetch(`http://ip-api.com/json/${ip}`);
                if (finalFallbackResponse.ok) {
                    const finalFallbackResult = await finalFallbackResponse.json();
                    console.log('🔍 getIpDetails: Final fallback API Response from ip-api.com:', JSON.stringify(finalFallbackResult, null, 2));
                    
                    const { regionName, country, ...rest } = finalFallbackResult;
                    const finalFallbackProcessed = {
                        ...rest,
                        region_name: regionName,
                        country_name: country
                    };
                    
                    console.log('🔍 getIpDetails: Final fallback processed result:', JSON.stringify(finalFallbackProcessed, null, 2));
                    return finalFallbackProcessed;
                }
            } catch (finalFallbackError) {
                console.error('❌ getIpDetails: All APIs failed:', finalFallbackError);
            }
        }
    }
}

const createUserJSON = async (userId) => {
    try {
        if (userId) {
            const dir = `${process.env.SCRIPT_DIRECTORY}/client`;
            const userIdStr = userId.toString(); // convert ObjectId to string
            const userDir = path.join(dir, userIdStr);
            const filePath = path.join(userDir, 'scripts.json');
            const content = [];

            await fs.mkdir(userDir, { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(content, null, 2));

            console.log(`Created scripts.json for user ${userIdStr} at ${filePath}`);
        } else {
            console.log('No userId provided.');
        }
    } catch (error) {
        console.log('Error creating scripts.json:', error);
    }
};


const extractPlainText = (elements)=> {
    return elements.map(el => {
        if (el.children && Array.isArray(el.children)) {
            return el.children.map(child => child.text || '').join('');
        }
        return '';
    }).join('\n'); // You can use space or '\n' based on formatting need
}

module.exports = { getIpDetails, createUserJSON, extractPlainText}