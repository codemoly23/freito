import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, VendorType, PartyStatus } from "../lib/generated/prisma/client";

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

const bangladeshiVendors = [
  {
    name: "Maersk Bangladesh Ltd",
    type: VendorType.SHIPPING_LINE,
    email: "bd.import@maersk.com",
    phone: "+880 2 55667788",
    address: "Plot 3, Road 23, Gulshan-1, Dhaka 1212, Bangladesh",
    paymentTerms: "Net 14 Days",
    notes: "Primary ocean shipping line. Global container transport operator.",
    contact: {
      name: "Anisur Rahman",
      email: "anisur.rahman@maersk.com",
      phone: "+880 1711223344",
      designation: "Manager - Ocean Customer Service",
      isPrimary: true
    }
  },
  {
    name: "Biman Bangladesh Airlines Cargo",
    type: VendorType.AIRLINE,
    email: "cargo@biman.gov.bd",
    phone: "+880 2 8901600",
    address: "Cargo Village, Hazrat Shahjalal International Airport, Kurmitola, Dhaka, Bangladesh",
    paymentTerms: "Advance Pay Order",
    notes: "National flag carrier. Handles import/export air cargo terminal handling.",
    contact: {
      name: "Nazrul Islam",
      email: "nazrul.cargo@biman.gov.bd",
      phone: "+880 1819556677",
      designation: "DGM - Cargo Operations",
      isPrimary: true
    }
  },
  {
    name: "Bengal Logistics Ltd (C&F)",
    type: VendorType.C_AND_F_AGENT,
    email: "info@bengallogistics.com",
    phone: "+880 31 721525",
    address: "Jahan Building No. 3, Agrabad C/A, Chittagong, Bangladesh",
    paymentTerms: "Net 30 Days",
    notes: "Licensed Customs Broker at Chittagong Port Custom House.",
    contact: {
      name: "Kamrul Hasan",
      email: "kamrul@bengallogistics.com",
      phone: "+880 1713009988",
      designation: "Customs Clearance Lead",
      isPrimary: true
    }
  },
  {
    name: "Truck Lagbe Corporate Logistics",
    type: VendorType.TRUCK_VENDOR,
    email: "corporate@trucklagbe.com",
    phone: "+880 9638016380",
    address: "House 450, Road 31, Mohakhali DOHS, Dhaka, Bangladesh",
    paymentTerms: "Net 15 Days",
    notes: "Corporate trucking and container prime mover fleet operator.",
    contact: {
      name: "Syed Mofizul Islam",
      email: "mofizul@trucklagbe.com",
      phone: "+880 1912445566",
      designation: "Head of Corporate Accounts",
      isPrimary: true
    }
  },
  {
    name: "Summit Alliance Port Limited (SAPL)",
    type: VendorType.WAREHOUSE_CFS,
    email: "cfs.ops@saplbd.com",
    phone: "+880 31 2501112",
    address: "Katghar, Patenga, Chittagong, Bangladesh",
    paymentTerms: "Net 30 Days",
    notes: "Off-dock CFS and ICD container depot service provider at Chittagong.",
    contact: {
      name: "Rashedul Karim",
      email: "rashed.karim@saplbd.com",
      phone: "+880 1711998877",
      designation: "CFS Yard In-Charge",
      isPrimary: true
    }
  },
  {
    name: "DSV Air & Sea Bangladesh Ltd",
    type: VendorType.OVERSEAS_AGENT,
    email: "dsv.dhaka@bd.dsv.com",
    phone: "+880 2 222283081",
    address: "Saba Palace, Road 11, Banani, Dhaka 1213, Bangladesh",
    paymentTerms: "Net 30 Days",
    notes: "Global freight forwarding network partner agent.",
    contact: {
      name: "Zahidul Amin",
      email: "zahidul.amin@bd.dsv.com",
      phone: "+880 1755667788",
      designation: "Director - Global Network Relations",
      isPrimary: true
    }
  },
  {
    name: "Green Delta Insurance Company Ltd",
    type: VendorType.INSURANCE_PROVIDER,
    email: "marine.cargo@greendelta.com.bd",
    phone: "+880 2 223386001",
    address: "Green Delta AIMS Tower, 51-52 Mohakhali C/A, Dhaka, Bangladesh",
    paymentTerms: "Immediate Premium",
    notes: "Marine cargo open cover insurance provider.",
    contact: {
      name: "Fahmida Chowdhury",
      email: "fahmida.c@greendelta.com.bd",
      phone: "+880 1730004455",
      designation: "Senior VP - Marine Underwriting",
      isPrimary: true
    }
  },
  {
    name: "Eastern Bank PLC (Trade Center)",
    type: VendorType.BANK,
    email: "trade.ops@ebl-bd.com",
    phone: "+880 2 9556360",
    address: "EBL Head Office, 100 Gulshan Avenue, Dhaka 1212, Bangladesh",
    paymentTerms: "Bank commission / L/C",
    notes: "L/C opening, document endorsement, and trade finance bank.",
    contact: {
      name: "Mizanur Rahman",
      email: "mizanur.trade@ebl-bd.com",
      phone: "+880 1713112233",
      designation: "AVP - Trade Finance Services",
      isPrimary: true
    }
  },
  {
    name: "Chittagong Port Authority (CPA)",
    type: VendorType.OTHER,
    email: "info@cpa.gov.bd",
    phone: "+880 31 2510889",
    address: "Bandar Bhaban, Chittagong 4100, Bangladesh",
    paymentTerms: "Direct Customs Duty",
    notes: "Port regulatory charges, pilotage, and container handling.",
    contact: {
      name: "Nasser Uddin",
      email: "nasser.cpa@cpa.gov.bd",
      phone: "+880 1819334455",
      designation: "Assistant Port Traffic Manager",
      isPrimary: true
    }
  }
];

async function main() {
  console.log("Seeding real Bangladeshi logistics vendors...");

  // Get the primary company
  const company = await prisma.company.findFirst();
  if (!company) {
    console.error("Error: No company found in the database. Please seed the platform first.");
    process.exit(1);
  }

  console.log(`Target Company: ${company.name} (ID: ${company.id})`);

  for (const vData of bangladeshiVendors) {
    // Check if vendor already exists
    const existing = await prisma.vendor.findFirst({
      where: {
        companyId: company.id,
        name: vData.name,
      }
    });

    if (existing) {
      console.log(`Vendor "${vData.name}" already exists. Skipping.`);
      continue;
    }

    console.log(`Creating vendor: ${vData.name} (${vData.type})...`);

    // Create the vendor and contact
    await prisma.vendor.create({
      data: {
        companyId: company.id,
        name: vData.name,
        type: vData.type,
        email: vData.email,
        phone: vData.phone,
        address: vData.address,
        paymentTerms: vData.paymentTerms,
        notes: vData.notes,
        status: PartyStatus.ACTIVE,
        contacts: {
          create: {
            name: vData.contact.name,
            email: vData.contact.email,
            phone: vData.contact.phone,
            designation: vData.contact.designation,
            isPrimary: vData.contact.isPrimary
          }
        }
      }
    });
  }

  console.log("\nSuccess! Bangladeshi vendors seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
