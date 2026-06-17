'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/shared/BackButton';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Pre-loaded beneficiary data ──────────────────────────────────────────────

const RAW_ENTRIES = [
  // SBI accounts
  { beneficiaryName: 'As Brand Oil',                   accountNumber: '00000010725233041', bankName: 'STATE BANK OF INDIA',    branchName: 'SECUNDERABAD MAIN BRANCH',              transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Eshwar Agencies',                accountNumber: '00000040053697873', bankName: 'STATE BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Guptha Traders',                 accountNumber: '00000040590887634', bankName: 'STATE BANK OF INDIA',    branchName: 'SADASIVAPETA ADB',                      transferLimit: 300000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Kishor Enterprises',             accountNumber: '00000035591466455', bankName: 'STATE BANK OF INDIA',    branchName: 'BAZAARGHAT',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Laxman Marotirsao Gavahan',      accountNumber: '00000020294955193', bankName: 'STATE BANK OF INDIA',    branchName: 'OSMANGUNJ',                             transferLimit: 200000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'LORVEN ENTERPRISES',             accountNumber: '00000039035367121', bankName: 'STATE BANK OF INDIA',    branchName: 'SME BRANCH PARISHRAM BHAVAN',           transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'M Pitambar',                     accountNumber: '00000010647729943', bankName: 'STATE BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Mattam Aravind Kumar',           accountNumber: '00000041556627353', bankName: 'STATE BANK OF INDIA',    branchName: 'NEW COLLECTORATE COMPLEX SANGAREDDY',   transferLimit: 40000,   supplierType: 'RENT'     },
  { beneficiaryName: 'MK Traders',                     accountNumber: '00000010647584496', bankName: 'STATE BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'RAMESH VAGGEKAR',                accountNumber: '00000011063285902', bankName: 'STATE BANK OF INDIA',    branchName: 'BIDAR',                                 transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sanathnagar Polythene Ind',      accountNumber: '00000062250835114', bankName: 'STATE BANK OF INDIA',    branchName: 'HUSSAINI ALAM HYDERABAD',               transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Shiva Sai Agencies',             accountNumber: '00000032723913648', bankName: 'STATE BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SRI SAI SALES CORPORATION',      accountNumber: '00000032774895572', bankName: 'STATE BANK OF INDIA',    branchName: 'MUSHEERABAD',                           transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Tirumala General',           accountNumber: '00000030719890584', bankName: 'STATE BANK OF INDIA',    branchName: 'PATANCHERU',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SriRam Agencies',                accountNumber: '00000052128554153', bankName: 'STATE BANK OF INDIA',    branchName: 'ZAHEERABAD',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SSP Agencies',                   accountNumber: '00000038398810250', bankName: 'STATE BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 200000,  supplierType: 'SUPPLIER' },
  // Other banks
  { beneficiaryName: 'Taher Ali Tea Traders',          accountNumber: '102931100000238',   bankName: 'ANDHRA BANK',            branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'AM Enterprises',                 accountNumber: '19440200000367',    bankName: 'BANK OF BARODA',         branchName: 'CHILAKALGUDA HYDERABAD',                transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Balaji Tea Corporation',         accountNumber: '512020010014678',   bankName: 'CITY UNION BANK',        branchName: 'HYDERABAD SIDDIAMBER BAZAAR',           transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'BNK FOODS Products',             accountNumber: '1481223000000052',  bankName: 'KARUR VYSYA BANK',       branchName: 'HYDERABAD MEERPET',                     transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'CR Marketing',                   accountNumber: '08132560000252',    bankName: 'HDFC BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Deepak Rawa Jagdish Prasad',     accountNumber: '033602000013305',   bankName: 'INDIAN OVERSEAS BANK',   branchName: 'HYDERABAD BEGUM BAZAAR',                transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Dhanush Traders',                accountNumber: '60303599999',       bankName: 'BANK OF MAHARASHTRA',    branchName: 'AGRI HI TECH HYDERABAD',                transferLimit: 300000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Dr G Santosh',                   accountNumber: '1723104000088080',  bankName: 'IDBI BANK',              branchName: 'SANGAREDDY',                            transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'DVS Agencies',                   accountNumber: '50200114448983',    bankName: 'HDFC BANK',              branchName: 'HATSINGIMARI',                          transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Ganapathi Sugars Industries',    accountNumber: '503405010017008',   bankName: 'UNION BANK OF INDIA',    branchName: 'IFB',                                   transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'GLOBAL TRADERS',                 accountNumber: '131205009793',      bankName: 'ICICI BANK',             branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Gokul Krishi Udyog Pvt Ltd',    accountNumber: '665005600158',      bankName: 'ICICI BANK',             branchName: 'HYDERABAD',                             transferLimit: 250000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Greenboxco Hvacr Pvt',          accountNumber: '920030067386372',   bankName: 'AXIS BANK',              branchName: 'HYDERABAD',                             transferLimit: 300000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'GUVVALA NAVEEN KUMAR',           accountNumber: '100129829473',      bankName: 'INDUSIND BANK',          branchName: 'TOWLICHOWKI HYDERABAD',                 transferLimit: 100000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'Hari Hara Enterprises',          accountNumber: '642901010050054',   bankName: 'UNION BANK OF INDIA',    branchName: 'RUDRARAM',                              transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Harini Traders',                 accountNumber: '1723104000042510',  bankName: 'IDBI BANK',              branchName: 'DWARKA',                                transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Harsha Consultancy',             accountNumber: '564920110000181',   bankName: 'BANK OF INDIA',          branchName: 'SANGAREDDY',                            transferLimit: 500000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'Hashmi Agencies',                accountNumber: '6513057715',        bankName: 'KOTAK MAHINDRA BANK',    branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Healthy Heart Foods',            accountNumber: '000851000218',      bankName: 'ICICI BANK',             branchName: 'CIBD HYDERABAD',                        transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'I CARE EYE HOSPITAL',            accountNumber: '1723102000001762',  bankName: 'IDBI BANK',              branchName: 'SANGAREDDY',                            transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'ISHA HEALTH CARE DISTRIBUTORS',  accountNumber: '05100210000458',    bankName: 'UCO BANK',               branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Jai Sri Ganesh Agencies',        accountNumber: '131205010143',      bankName: 'ICICI BANK',             branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'K NAGARAJU',                     accountNumber: '2284102000000259',  bankName: 'IDBI BANK',              branchName: 'MEHDIPATNAM',                           transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'Kethaki Sangameshwara Agencies', accountNumber: '370002000000022',   bankName: 'INDIAN OVERSEAS BANK',   branchName: 'SADASIVPET',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Kisan Enterprises',              accountNumber: '50200080065237',    bankName: 'HDFC BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Kota Agencies',                  accountNumber: '102911011000303',   bankName: 'ANDHRA BANK',            branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Laxminarayana UB',               accountNumber: '00451050090424',    bankName: 'HDFC BANK',              branchName: 'CHANDA NGR HYDERABAD',                  transferLimit: 50000,   supplierType: 'OTHER'    },
  { beneficiaryName: 'Lotus Brand Coffee Industries',  accountNumber: '862620110000236',   bankName: 'BANK OF INDIA',          branchName: 'HYDERABAD SERVICE BRANCH',              transferLimit: 10000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'M M Traders',                    accountNumber: '3780216464',        bankName: 'CENTRAL BANK OF INDIA',  branchName: 'BEGUMBAZAR',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'M Pithamber Kirana',             accountNumber: '131205009743',      bankName: 'ICICI BANK',             branchName: 'SANGAREDDY',                            transferLimit: 400000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Mahalakshmi Agencies',           accountNumber: '560371000668396',   bankName: 'UNION BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'MAHESHWARA EDUCATIONAL SOCIETY', accountNumber: '439601000292',      bankName: 'ICICI BANK',             branchName: 'ISNAPUR',                               transferLimit: 500000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'MAHINDRA AND MAHINDRA FINANCIAL',accountNumber: '57500000119317',    bankName: 'HDFC BANK',              branchName: 'MUMBAI',                                transferLimit: 125000,  supplierType: 'LOAN'     },
  { beneficiaryName: 'Masanpally Balraj',              accountNumber: '81010200001352',    bankName: 'BANK OF BARODA',         branchName: 'SADASHIVPET TELANGANA',                 transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'Mohanlal Chunnilal',             accountNumber: '1404129000000288',  bankName: 'KARUR VYSYA BANK',       branchName: 'HYDERABAD MAIN',                        transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'NATIONAL TRADERS',               accountNumber: '102911010000102',   bankName: 'UNION BANK OF INDIA',    branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'New Hyderabad Agencies',         accountNumber: '50200027908869',    bankName: 'HDFC BANK',              branchName: 'BEGUM BAZAR',                           transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'PARAKH TEA SALES',               accountNumber: '065150050800898',   bankName: 'TAMILNAD MERCANTILE BANK',branchName: 'HYDERABAD',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Pluckwalk Technologies Pvt Ltd', accountNumber: 'BBLTAXCRN507765',   bankName: 'AXIS BANK',              branchName: 'CENTRALISED COLLECTION HUB',            transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'Pragathi Enterprises',           accountNumber: '1404223000000294',  bankName: 'KARUR VYSYA BANK',       branchName: 'HYDERABAD MAIN',                        transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Radha Sarweshwar and Co',        accountNumber: '50200001332580',    bankName: 'HDFC BANK',              branchName: 'BEGUM BAZAR',                           transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Raghav and Brothers',            accountNumber: '03182000007372',    bankName: 'HDFC BANK',              branchName: 'CHARMINAR HYDERABAD',                   transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Raghavendra Agencies',           accountNumber: '630505024315',      bankName: 'ICICI BANK',             branchName: 'HYDERABAD HIMAYAT NAGAR',               transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'RAJ ENTERPRISES',                accountNumber: '924030052653821',   bankName: 'AXIS BANK',              branchName: 'SANGAREDDY',                            transferLimit: 300000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Rajendra and Co',                accountNumber: '059605001578',      bankName: 'ICICI BANK',             branchName: 'MALAKPET',                              transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Ram Kumar G',                    accountNumber: '040110100029808',   bankName: 'ANDHRA BANK',            branchName: 'NIZAMSHAHI ROAD',                       transferLimit: 100000,  supplierType: 'OTHER'    },
  { beneficiaryName: 'Rockwell Industries Limited',    accountNumber: '00422320002072',    bankName: 'HDFC BANK',              branchName: 'HYDERABAD SECUNDERABAD',                transferLimit: 300000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Royal Enterprises',              accountNumber: '1723653800000125',  bankName: 'IDBI BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Rozi Enterprises',               accountNumber: '02720100021191',    bankName: 'DCB BANK',               branchName: 'HYDERABAD',                             transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Santosh Trading',                accountNumber: '040111100002023',   bankName: 'ANDHRA BANK',            branchName: 'NIZAMSHAHI ROAD',                       transferLimit: 150000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sasyakranthi Agro and Food',     accountNumber: '049113100009442',   bankName: 'UNION BANK OF INDIA',    branchName: 'RAICHUR',                               transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Shive Shakti Agro',              accountNumber: '665005501137',      bankName: 'ICICI BANK',             branchName: 'AMRITSAR',                              transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Shree Kesar Trading Co',         accountNumber: '8111307070',        bankName: 'KOTAK MAHINDRA BANK',    branchName: 'MALAKPET BRANCH HYDERABAD',             transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Shree Laxmi Agencies',           accountNumber: '50200098761354',    bankName: 'HDFC BANK',              branchName: 'NARSAPUR MEDAK',                        transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SHRI MAHILA GRIHA UDYOG LIJJAT', accountNumber: '31630200000017',   bankName: 'BANK OF BARODA',         branchName: 'MALAKPET BR HYDERABAD',                 transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Shuffl Mart',                    accountNumber: '3935002100009655',  bankName: 'PUNJAB NATIONAL BANK',   branchName: 'HYDERABAD HABSIGUDA',                   transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sorbchem India Pvt Ltd',         accountNumber: '000305503670',      bankName: 'ICICI BANK',             branchName: 'VADODARA',                              transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Balaji Agencies',            accountNumber: '08132560000193',    bankName: 'HDFC BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Balaji Corporation',         accountNumber: '1404135000018122',  bankName: 'KARUR VYSYA BANK',       branchName: 'HYDERABAD MAIN',                        transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Balaji Trading Co',          accountNumber: '665005501156',      bankName: 'ICICI BANK',             branchName: 'HYDERABAD',                             transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Bhavani Agencies',           accountNumber: '917020070643445',   bankName: 'AXIS BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SRI HARSHINI AGENCY',            accountNumber: '120000386327',      bankName: 'CANARA BANK',            branchName: 'SANGAREDDY II',                         transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Kirana Stores',              accountNumber: '50200026364289',    bankName: 'HDFC BANK',              branchName: 'BEGUM BAZAR',                           transferLimit: 200000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Laxmi Agencies',             accountNumber: '924030022982418',   bankName: 'AXIS BANK',              branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Renuka Traders',             accountNumber: '131205009842',      bankName: 'ICICI BANK',             branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Sai Venkateshwara Agencies', accountNumber: '5345260751',        bankName: 'KOTAK MAHINDRA BANK',    branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'SRI TIRUMALA GENERAL AND FANCY', accountNumber: '923030060938638',   bankName: 'AXIS BANK',              branchName: 'SANGAREDDY',                            transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Varasiddi Vinayaka Agencies',accountNumber: '239802000000096',   bankName: 'INDIAN OVERSEAS BANK',   branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'Sri Veerabadhra Agencies',       accountNumber: '239802000000094',   bankName: 'INDIAN OVERSEAS BANK',   branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'ST AUGUSTIN EDUCATIONAL SOCIETY',accountNumber: '2349225731',        bankName: 'KOTAK MAHINDRA BANK',    branchName: 'PATTANCHERU',                           transferLimit: 5000000, supplierType: 'OTHER'    },
  { beneficiaryName: 'Taher Ali Tea Traders (2)',      accountNumber: '102911100001635',   bankName: 'ANDHRA BANK',            branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
  { beneficiaryName: 'The Nilgiri Tea Emporium',       accountNumber: '085811011011076',   bankName: 'UNION BANK OF INDIA',    branchName: 'NAMPALLI',                              transferLimit: 100000,  supplierType: 'SUPPLIER' },
  { beneficiaryName: 'VALLAB GHANAPARHI ENTERPRISES',  accountNumber: '923020046545886',   bankName: 'AXIS BANK',              branchName: 'SANGAREDDY',                            transferLimit: 50000,   supplierType: 'SUPPLIER' },
];

const TYPE_COLORS: Record<string, string> = {
  SUPPLIER: 'bg-blue-100 text-blue-700',
  RENT:     'bg-purple-100 text-purple-700',
  LOAN:     'bg-orange-100 text-orange-700',
  OTHER:    'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  HIGH:     'text-green-700 bg-green-50 border-green-200',
  REVIEW:   'text-amber-700 bg-amber-50 border-amber-200',
  NO_MATCH: 'text-red-700 bg-red-50 border-red-200',
};

interface PreviewRow {
  beneficiaryName: string; accountNumber: string; bankName: string;
  branchName?: string; transferLimit?: number; supplierType: string;
  matchedSupplier: { id: string; name: string } | null;
  matchScore: number; status: 'HIGH' | 'REVIEW' | 'NO_MATCH';
}

export default function ImportBankAccountsPage() {
  const router = useRouter();
  const [preview, setPreview]       = useState<PreviewRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [done, setDone]             = useState<{ imported: number; created: number; skipped: number } | null>(null);
  // Per-row overrides
  const [overrides, setOverrides]   = useState<Record<number, {
    supplierId?: string; createSupplier?: boolean; supplierType?: string; skip?: boolean;
  }>>({});

  async function runPreview() {
    setLoading(true);
    try {
      const res = await api.post('/suppliers/bank-accounts/import-preview', { entries: RAW_ENTRIES });
      setPreview(res.data);
      // Seed overrides from preview
      const init: typeof overrides = {};
      res.data.forEach((row: PreviewRow, i: number) => {
        init[i] = {
          supplierId:     row.matchedSupplier?.id,
          createSupplier: row.status === 'NO_MATCH',
          supplierType:   row.supplierType,
          skip:           false,
        };
      });
      setOverrides(init);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Preview failed');
    } finally { setLoading(false); }
  }

  async function runImport() {
    const entries = preview
      .map((row, i) => {
        const o = overrides[i] ?? {};
        if (o.skip) return null;
        if (!o.supplierId && !o.createSupplier) return null;
        return {
          beneficiaryName: row.beneficiaryName,
          accountNumber:   row.accountNumber,
          bankName:        row.bankName,
          branchName:      row.branchName,
          transferLimit:   row.transferLimit,
          supplierId:      o.supplierId,
          createSupplier:  o.createSupplier,
          supplierType:    o.supplierType ?? row.supplierType,
          isPrimary:       true,
        };
      })
      .filter(Boolean);

    setImporting(true);
    try {
      const res = await api.post('/suppliers/bank-accounts/import-execute', { entries });
      setDone(res.data);
      toast.success(`Imported ${res.data.imported} accounts`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Import failed');
    } finally { setImporting(false); }
  }

  const toImport = preview.filter((_, i) => !overrides[i]?.skip && (overrides[i]?.supplierId || overrides[i]?.createSupplier)).length;

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/suppliers" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Import Bank Accounts</h1>
            <p className="text-xs text-gray-500">{RAW_ENTRIES.length} beneficiaries loaded · limit=1 already filtered</p>
          </div>
        </div>

        {/* Done state */}
        {done && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
            <p className="text-2xl font-bold text-green-700">✓ Import Complete</p>
            <p className="text-sm text-gray-600">
              <strong>{done.imported}</strong> accounts imported ·{' '}
              <strong>{done.created}</strong> new suppliers created ·{' '}
              <strong>{done.skipped}</strong> skipped (already existed or no match)
            </p>
            <button onClick={() => router.push('/dashboard/suppliers')}
              className="mt-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              Go to Suppliers
            </button>
          </div>
        )}

        {/* Action bar */}
        {!done && (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-4">
            {preview.length === 0 ? (
              <button onClick={runPreview} disabled={loading}
                className="px-5 py-2 bg-[#1B4F8A] text-white rounded-lg text-sm font-semibold hover:bg-[#163f6e] disabled:opacity-60">
                {loading ? 'Loading matches…' : 'Load & Match Suppliers'}
              </button>
            ) : (
              <>
                <div className="text-sm text-gray-600 flex-1">
                  <strong className="text-green-700">{preview.filter((r) => r.status === 'HIGH').length}</strong> high confidence ·{' '}
                  <strong className="text-amber-600">{preview.filter((r) => r.status === 'REVIEW').length}</strong> need review ·{' '}
                  <strong className="text-red-600">{preview.filter((r) => r.status === 'NO_MATCH').length}</strong> no match ·{' '}
                  <strong>{toImport}</strong> will be imported
                </div>
                <button onClick={runImport} disabled={importing || toImport === 0}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                  {importing ? 'Importing…' : `Import ${toImport} Accounts`}
                </button>
              </>
            )}
          </div>
        )}

        {/* Preview table */}
        {preview.length > 0 && !done && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                <tr>
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Beneficiary Name</th>
                  <th className="px-3 py-2 text-left">Account No</th>
                  <th className="px-3 py-2 text-left">Bank</th>
                  <th className="px-3 py-2 text-left">Matched Supplier</th>
                  <th className="px-3 py-2 text-center">Score</th>
                  <th className="px-3 py-2 text-center">Type</th>
                  <th className="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => {
                  const o = overrides[i] ?? {};
                  const skipped = !!o.skip;
                  return (
                    <tr key={i} className={skipped ? 'opacity-30 bg-gray-50' : ''}>
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{row.beneficiaryName}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{row.accountNumber}</td>
                      <td className="px-3 py-2 text-gray-600">{row.bankName}</td>
                      <td className="px-3 py-2">
                        {row.matchedSupplier ? (
                          <span className={`inline-block px-2 py-0.5 rounded border text-[11px] ${STATUS_COLORS[row.status]}`}>
                            {row.matchedSupplier.name}
                          </span>
                        ) : (
                          <span className="text-red-500 text-[11px]">
                            {o.createSupplier ? '+ Create new supplier' : 'No match — will skip'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[11px] font-semibold ${row.status === 'HIGH' ? 'text-green-600' : row.status === 'REVIEW' ? 'text-amber-600' : 'text-red-500'}`}>
                          {row.matchScore}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={o.supplierType ?? row.supplierType}
                          onChange={e => setOverrides(prev => ({ ...prev, [i]: { ...prev[i], supplierType: e.target.value } }))}
                          className="text-[11px] border border-gray-200 rounded px-1 py-0.5"
                          disabled={skipped}
                        >
                          {['SUPPLIER', 'RENT', 'LOAN', 'OTHER'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setOverrides(prev => ({ ...prev, [i]: { ...prev[i], skip: !prev[i]?.skip } }))}
                          className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-colors ${
                            skipped
                              ? 'border-gray-300 text-gray-400 hover:border-green-400 hover:text-green-600'
                              : 'border-red-200 text-red-500 hover:bg-red-50'
                          }`}
                        >
                          {skipped ? 'Undo' : 'Skip'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
