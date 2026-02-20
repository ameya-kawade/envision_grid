export const getMockRiskData = () => {
    // List of Indian states/UTs from the GeoJSON (approximate list for mocking)
    const states = [
        "Andaman & Nicobar Island", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chandigarh", "Chhattisgarh", "Dadara & Nagar Havelli", "Daman & Diu", "Goa",
        "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka",
        "Kerala", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
        "Mizoram", "Nagaland", "NCT of Delhi", "Odisha", "Puducherry", "Punjab", "Rajasthan",
        "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
    ];

    const data = {};

    states.forEach(state => {
        // Generate random pollution value between 0 and 300
        const pollutionValue = Math.floor(Math.random() * 300);
        let trend = 'stable';
        if (Math.random() > 0.6) trend = 'increasing';
        else if (Math.random() > 0.6) trend = 'decreasing';

        data[state] = {
            pollutionValue,
            trend,
            stateName: state
        };
    });

    return data;
};
