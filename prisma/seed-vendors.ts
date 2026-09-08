import "dotenv/config";
import crypto from "crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import {
  PrismaClient,
  vendor_type as VendorType,
  vendor_status as PartyStatus,
} from "../lib/generated/prisma/client";

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  const url = new URL(databaseUrl);
  const isAzure = url.hostname.endsWith(".mysql.database.azure.com");
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: isAzure
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

const vendorsToSeed = [
  // --- AIRLINES (AIR) ---
  {
    name: "Biman Cargo",
    type: VendorType.AIRLINE,
    email: "cargomarketing@bdbiman.com",
    phone: "+88028901500",
    address: "Cargo Village, Hazrat Shahjalal International Airport, Kurmitola, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "National flag carrier cargo service of Bangladesh.",
    contact: {
      name: "Mohammad Ali",
      email: "ali.cargo@bdbiman.com",
      phone: "+8801711000111",
      designation: "Cargo Handling Manager",
    },
  },
  {
    name: "Emirates SkyCargo",
    type: VendorType.AIRLINE,
    email: "skycardac@emirates.com",
    phone: "+88028901344",
    address: "Room 304, Cargo Village, Hazrat Shahjalal International Airport, Dhaka, Bangladesh",
    paymentTerms: "Net 15",
    notes: "Premium international air cargo services via Dubai.",
    contact: {
      name: "Faisal Masud",
      email: "faisal.masud@emirates.com",
      phone: "+8801711000222",
      designation: "Cargo Manager BD",
    },
  },
  {
    name: "Qatar Airways Cargo",
    type: VendorType.AIRLINE,
    email: "daccargo@bd.qatarairways.com",
    phone: "+88028901761",
    address: "Cargo Village Complex, 2nd Floor, HSIA, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Leading air freight carrier operating out of Dhaka.",
    contact: {
      name: "Nasir Uddin",
      email: "nasir.uddin@bd.qatarairways.com",
      phone: "+8801711000333",
      designation: "Operations Supervisor",
    },
  },
  {
    name: "Saudia Cargo",
    type: VendorType.AIRLINE,
    email: "daccargo@saudia.com",
    phone: "+88028901123",
    address: "Cargo Terminal, HSIA, Kurmitola, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Reliable air cargo transport to Middle East and global destinations.",
    contact: {
      name: "Kamrul Islam",
      email: "kamrul.islam@saudia.com",
      phone: "+8801711000444",
      designation: "Station Manager",
    },
  },
  {
    name: "Turkish Cargo",
    type: VendorType.AIRLINE,
    email: "daccargo@thy.com",
    phone: "+88028901524",
    address: "Hazrat Shahjalal International Airport, Kurmitola, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Fast growing air cargo network with extensive European coverage.",
    contact: {
      name: "Arifur Rahman",
      email: "arifur.rahman@thy.com",
      phone: "+8801711000555",
      designation: "Cargo Operations Lead",
    },
  },
  {
    name: "Cathay Cargo",
    type: VendorType.AIRLINE,
    email: "dac_cargo@cathaypacific.com",
    phone: "+88028901412",
    address: "Unit 5, Cargo Village, HSIA, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Excellent connectivity to East Asia, North America, and Australia.",
    contact: {
      name: "Rashedul Islam",
      email: "rashedul.islam@cathaypacific.com",
      phone: "+8801711000666",
      designation: "Cargo Services Officer",
    },
  },

  // --- SHIPPING LINES (SHIP) ---
  {
    name: "Maersk Line Bangladesh",
    type: VendorType.SHIPPING_LINE,
    email: "bd.import@maersk.com",
    phone: "+8809612345678",
    address: "Court de la ACME, 4th Floor, 1/4 Kallayanpur, Mirpur Road, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Largest container shipping line operating in Bangladesh.",
    contact: {
      name: "Saiful Islam",
      email: "saiful.islam@maersk.com",
      phone: "+8801712000111",
      designation: "Import Manager",
    },
  },
  {
    name: "MSC Bangladesh",
    type: VendorType.SHIPPING_LINE,
    email: "info@msc.com.bd",
    phone: "+8802222283921",
    address: "Gulshan Tower, 8th Floor, Plot 31, Road 53, Gulshan-2, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Global leader in container shipping with robust presence in Chittagong port.",
    contact: {
      name: "Rahat Khan",
      email: "rahat.khan@msc.com.bd",
      phone: "+8801712000222",
      designation: "Operations Lead",
    },
  },
  {
    name: "CMA CGM Bangladesh",
    type: VendorType.SHIPPING_LINE,
    email: "dka.genbox@cma-cgm.com",
    phone: "+88029881647",
    address: "Crystal Palace, 11th Floor, SE(D) 22 Road 140, Gulshan 1, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "French container transportation and shipping company.",
    contact: {
      name: "Imran Hossain",
      email: "imran.hossain@cma-cgm.com",
      phone: "+8801712000333",
      designation: "Customer Service Manager",
    },
  },
  {
    name: "Ocean Network Express (ONE) Bangladesh",
    type: VendorType.SHIPPING_LINE,
    email: "bd.ops@one-line.com",
    phone: "+88028834921",
    address: "Laila Tower, 12th Floor, 8 Gulshan Avenue, Gulshan 1, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Japanese joint-venture container shipping line.",
    contact: {
      name: "Zahid Hasan",
      email: "zahid.hasan@one-line.com",
      phone: "+8801712000444",
      designation: "Logistics Coordinator",
    },
  },
  {
    name: "Hapag-Lloyd Bangladesh",
    type: VendorType.SHIPPING_LINE,
    email: "bangladesh@service.hlag.com",
    phone: "+880255058471",
    address: "Symphony Building, 6th Floor, Plot SE(F) 9, Road 142, Gulshan South Avenue, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "German transportation company serving global trade routes.",
    contact: {
      name: "Mustafizur Rahman",
      email: "mustafizur.rahman@hlag.com",
      phone: "+8801712000555",
      designation: "Sales Director",
    },
  },
  {
    name: "COSCO Shipping Lines (Bangladesh)",
    type: VendorType.SHIPPING_LINE,
    email: "coscobd@coscon.com",
    phone: "+88029895241",
    address: "Red Crescent Concord Tower, 17 Mohakhali C/A, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Chinese state-owned shipping and logistics services company.",
    contact: {
      name: "Tanveer Ahmed",
      email: "tanveer.ahmed@coscon.com",
      phone: "+8801712000666",
      designation: "Documentation Lead",
    },
  },
  {
    name: "Evergreen Shipping Agency (Bangladesh)",
    type: VendorType.SHIPPING_LINE,
    email: "egbd-biz@evergreen-shipping.com.bd",
    phone: "+88029851601",
    address: "Richmond Concord, 9th Floor, 68 Gulshan Avenue, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Taiwanese container shipping company.",
    contact: {
      name: "Asif Chowdhury",
      email: "asif.chowdhury@evergreen-shipping.com.bd",
      phone: "+8801712000777",
      designation: "Line Manager",
    },
  },

  // --- TRUCK VENDORS (ROAD) ---
  {
    name: "Truck Lagbe",
    type: VendorType.TRUCK_VENDOR,
    email: "corporate@trucklagbe.com",
    phone: "+8809638000247",
    address: "House 250, Road 18, New DOHS, Mohakhali, Dhaka, Bangladesh",
    paymentTerms: "Net 15",
    notes: "Digital trucking platform offering standard and container haulage trucks.",
    contact: {
      name: "Anisul Haque",
      email: "anisul.haque@trucklagbe.com",
      phone: "+8801713000111",
      designation: "Corporate Sales Manager",
    },
  },
  {
    name: "Gati Bangladesh",
    type: VendorType.TRUCK_VENDOR,
    email: "bd.info@gati.com",
    phone: "+88029881881",
    address: "Plot 11, Road 2, Block A, Niketon, Gulshan-1, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Express distribution and supply chain solutions.",
    contact: {
      name: "Prasanta Dey",
      email: "prasanta.dey@gati.com",
      phone: "+8801713000222",
      designation: "Operations Manager",
    },
  },
  {
    name: "Bengal Logistics Limited",
    type: VendorType.TRUCK_VENDOR,
    email: "transport@bengal-logistics.com",
    phone: "+88028872045",
    address: "Bengal Centre, Plot 10, Road 4, Sector 3, Uttara, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Specialized in heavy project transport and local transport.",
    contact: {
      name: "Kamal Hossain",
      email: "kamal.hossain@bengal-logistics.com",
      phone: "+8801713000333",
      designation: "Fleet Manager",
    },
  },
  {
    name: "Rahman Transport Agency",
    type: VendorType.TRUCK_VENDOR,
    email: "rahman.transport@outlook.com",
    phone: "+8801711123456",
    address: "32/A Sadarghat Road, Chittagong, Bangladesh",
    paymentTerms: "Cash",
    notes: "Local trucking and container haulage between Dhaka and Chittagong.",
    contact: {
      name: "Motiur Rahman",
      email: "motiur.rahman@outlook.com",
      phone: "+8801713000444",
      designation: "Proprietor",
    },
  },
  {
    name: "Sundarban Courier Service",
    type: VendorType.TRUCK_VENDOR,
    email: "corporate@sundarban.com.bd",
    phone: "+88029661139",
    address: "24/25 Dilkusha C/A, Motijheel, Dhaka, Bangladesh",
    paymentTerms: "Net 30",
    notes: "Provides LTL (Less-than-Truckload) road freight and parcel delivery across Bangladesh.",
    contact: {
      name: "Abu Bakar",
      email: "bakar.sundarban@outlook.com",
      phone: "+8801713000555",
      designation: "Logistics In-charge",
    },
  },
  {
    name: "E-Courier Logistics",
    type: VendorType.TRUCK_VENDOR,
    email: "b2b@ecourier.com",
    phone: "+8809612500500",
    address: "House 4, Road 2/B, Block J, Baridhara, Dhaka, Bangladesh",
    paymentTerms: "Net 15",
    notes: "Tech-enabled logistics partner for parcel and truck delivery.",
    contact: {
      name: "Sajib Ahmed",
      email: "sajib.ahmed@ecourier.com",
      phone: "+8801713000666",
      designation: "B2B Deliveries Executive",
    },
  },
];

async function main() {
  console.log("Seeding vendors for Bangladesh...");

  // Find target company
  let company = await prisma.company.findFirst({
    where: { OR: [{ name: "Freito Demo Company" }, { name: "Freight Control Demo Company" }] },
  });

  if (!company) {
    company = await prisma.company.findFirst();
  }

  if (!company) {
    throw new Error("No company found in the database. Please run the main seed script first.");
  }

  console.log(`Seeding to Company: ${company.name} (ID: ${company.id})`);

  let count = 0;
  for (const v of vendorsToSeed) {
    const existing = await prisma.vendor.findFirst({
      where: {
        companyId: company.id,
        name: v.name,
      },
    });

    if (existing) {
      console.log(`Vendor already exists: ${v.name}`);
      continue;
    }

    const now = new Date();
    await prisma.vendor.create({
      data: {
        id: crypto.randomUUID(),
        companyId: company.id,
        name: v.name,
        type: v.type,
        email: v.email,
        phone: v.phone,
        address: v.address,
        paymentTerms: v.paymentTerms,
        notes: v.notes,
        status: PartyStatus.ACTIVE,
        updatedAt: now,
        vendorcontact: {
          create: {
            id: crypto.randomUUID(),
            name: v.contact.name,
            email: v.contact.email,
            phone: v.contact.phone,
            designation: v.contact.designation,
            isPrimary: true,
            updatedAt: now,
          },
        },
      },
    });
    console.log(`Created vendor: ${v.name} (${v.type})`);
    count++;
  }

  console.log(`Successfully seeded ${count} new vendors.`);
}

main()
  .catch((e) => {
    console.error("Error seeding vendors:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
