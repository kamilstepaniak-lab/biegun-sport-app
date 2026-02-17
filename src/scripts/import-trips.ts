import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// --- ENV LOADER ---
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach((line) => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase env vars in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// --- TYPES & HELPERS ---

interface CSVTrip {
    id: string;
    title: string;
    description: string;
    section: string;
    info: string;
    departureDate: string;
    departureDetails: string;
    returnDate: string;
    returnDetails: string;
    payment1_amount: string;
    payment1_method: string;
    payment1_due: string;
    payment2_amount: string;
    payment2_method: string;
    payment2_due: string;
    priceRules: string;
    passPaymentMethod: string;
}

// Simple CSV Parser handling quotes and semicolons
function parseCSV(content: string): string[][] {
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: string[][] = [];

    for (const line of lines) {
        const row: string[] = [];
        let current = '';
        let inQuote = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ';' && !inQuote) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim());
        result.push(row);
    }
    return result;
}

function parseDate(dateStr: string): string | null {
    // Format: DD.MM.YYYY
    if (!dateStr || dateStr.trim() === '') return null;
    const parts = dateStr.trim().split('.');
    if (parts.length !== 3) return null;
    // Make ISO string YYYY-MM-DD
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseTimeFromDetails(details: string, defaultTime: string): string {
    // Try to find (HH:MM)
    const match = details.match(/\((\d{2}:\d{2})\)/);
    if (match) {
        return match[1];
    }
    return defaultTime;
}

function parseLocation(details: string): string {
    // "BP Pasternik (07:30); Orlen..." -> just take the whole string or clean it
    return details.replace(/\s*\(\d{2}:\d{2}\)/g, '').trim() || details;
}

function parseAmount(amountStr: string): { amount: number, currency: 'PLN' | 'EUR', note?: string } {
    if (!amountStr) return { amount: 0, currency: 'PLN' };

    let currency: 'PLN' | 'EUR' = 'PLN';
    if (amountStr.toLowerCase().includes('euro')) currency = 'EUR';

    // Extract first number
    const match = amountStr.match(/(\d+[.,]?\d*)/);
    if (!match) return { amount: 0, currency };

    const amount = parseFloat(match[1].replace(',', '.'));
    return { amount, currency };
}

async function main() {
    console.log('🚀 Starting import...');

    // 1. Fetch Groups
    const { data: groups, error: groupsError } = await supabase.from('groups').select('id, name');
    if (groupsError) {
        console.error('Error fetching groups:', groupsError);
        process.exit(1);
    }

    console.log(`✅ Loaded ${groups.length} groups.`);

    // 2. Read CSV
    const csvPath = path.resolve(process.cwd(), 'trips.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('❌ trips.csv not found!');
        process.exit(1);
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(fileContent);
    // Skip header
    const dataRows = rows.slice(1);

    console.log(`Processing ${dataRows.length} trips...`);

    for (const row of dataRows) {
        if (row.length < 5) continue; // Skip empty/malformed

        // Map columns
        const tripData = {
            title: row[1],
            description: row[2],
            section: row[3],
            info: row[4],
            depDate: row[5],
            depDetails: row[6],
            retDate: row[7],
            retDetails: row[8],
            pay1_amt: row[9],
            pay1_method: row[10],
            pay1_due: row[11],
            pay2_amt: row[12],
            pay2_method: row[13],
            pay2_due: row[14],
            rules: row[15],
            pass_method: row[16]
        };

        console.log(`Importing: ${tripData.title}`);

        // Groups
        const groupName = tripData.section; // "Beeski"
        const group = groups.find(g => g.name.toLowerCase() === groupName.toLowerCase());
        if (!group) {
            console.warn(`  ⚠️ Group "${groupName}" not found. Skipping usage of group.`);
        }

        // Dates
        const dDate = parseDate(tripData.depDate);
        const rDate = parseDate(tripData.retDate);

        if (!dDate || !rDate) {
            console.error(`  ❌ Invalid dates for: ${tripData.title}. Skipping.`);
            continue;
        }

        const dTime = parseTimeFromDetails(tripData.depDetails, '00:00');
        const rTime = parseTimeFromDetails(tripData.retDetails, '00:00');

        // Trip Object
        const tripInsert = {
            title: tripData.title,
            description: tripData.description,
            departure_datetime: `${dDate}T${dTime}:00`,
            departure_location: tripData.depDetails || 'TBD',
            return_datetime: `${rDate}T${rTime}:00`,
            return_location: tripData.retDetails || 'TBD',
            status: 'draft', // Safety first
            bank_account_pln: '39 1240 1444 1111 0010 7170 4855', // Default
            bank_account_eur: 'PL21 1240 1444 1978 0010 7136 2778', // Default
            created_by: null // Admin import
        };

        const { data: trip, error: tripError } = await supabase.from('trips').insert(tripInsert).select().single();

        if (tripError) {
            console.error('  ❌ DB Error inserting trip:', tripError.message);
            continue;
        }

        console.log(`  ✅ Trip created: ${trip.id}`);

        // Link Group
        if (group) {
            await supabase.from('trip_groups').insert({ trip_id: trip.id, group_id: group.id });
        }

        // --- Payments ---
        const templates = [];

        // Installment 1
        if (tripData.pay1_amt) {
            const { amount, currency } = parseAmount(tripData.pay1_amt);
            if (amount > 0) {
                templates.push({
                    trip_id: trip.id,
                    payment_type: 'installment',
                    installment_number: 1,
                    is_first_installment: true,
                    amount,
                    currency,
                    due_date: parseDate(tripData.pay1_due) || null // "w dniu wyjazdu" -> null, handled manually?
                    // payment_method could be parsed from 'gotówka' etc.
                });
            }
        }

        // Installment 2
        if (tripData.pay2_amt) {
            const { amount, currency } = parseAmount(tripData.pay2_amt);
            if (amount > 0) {
                templates.push({
                    trip_id: trip.id,
                    payment_type: 'installment',
                    installment_number: 2,
                    is_first_installment: false,
                    amount,
                    currency,
                    due_date: parseDate(tripData.pay2_due) || null
                });
            }
        }

        // Season Pass / Rules
        if (tripData.rules) {
            // "Baby:2020+:5 euro;Child:..."
            // Strip quotes if parser didn't
            const rulesStr = tripData.rules.replace(/^"|"$/g, '');
            const rules = rulesStr.split(';'); // Split by semicolon inside the field

            for (const rule of rules) {
                // "Baby:2020+:5 euro"
                const parts = rule.split(':');
                if (parts.length >= 3) {
                    const category = parts[0].trim(); // Baby
                    const years = parts[1].trim(); // 2020+ or 2011-2019
                    const priceStr = parts[2].trim(); // 5 euro

                    let yFrom = null;
                    let yTo = null;

                    if (years.includes('-')) {
                        const [Start, End] = years.split('-');
                        yFrom = parseInt(Start) || null;
                        if (End) yTo = parseInt(End) || null;
                    } else if (years.includes('+')) {
                        yFrom = parseInt(years.replace('+', ''));
                    }

                    const { amount, currency } = parseAmount(priceStr);

                    templates.push({
                        trip_id: trip.id,
                        payment_type: 'season_pass',
                        category_name: category,
                        birth_year_from: yFrom,
                        birth_year_to: yTo,
                        amount,
                        currency,
                        includes_season_pass: true,
                        // passPaymentMethod maps to template.payment_method if needed
                    });
                }
            }
        }

        if (templates.length > 0) {
            const { error: templError } = await supabase.from('trip_payment_templates').insert(templates);
            if (templError) {
                console.error('  ⚠️ Error inserting templates:', templError.message);
            } else {
                console.log(`  ✅ Added ${templates.length} payment templates.`);
            }
        }

    }

    console.log('🎉 Import finished!');
}

main().catch(console.error);
