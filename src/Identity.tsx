import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import StoryImageCropModal from './components/StoryImageCropModal';
import ImagePreviewModal from './components/ImagePreviewModal';
import NativeGalleryModal from './components/NativeGalleryModal';
import { isNativeGalleryAvailable } from './utils/nativeImagePicker';
import { Country, State } from 'country-state-city';
import Toast from './Toast';
import LoadingDots from './components/LoadingDots';

type Wallet = { id: string; label: string; network: string; address: string };
type IdentityProfile = {
  id: string; firstName: string; middleName: string; lastName: string; username: string; email: string; emailVerified: boolean; memberSince: string;
  dateOfBirth: string; phone: string; phoneVerified: boolean; country: string; state: string; city: string; address: string;
  postalCode: string; nationality: string; gender: string; occupation: string;
  website: string; instagram: string; facebook: string; xHandle: string; telegram: string; discord: string; linkedin: string;
  language: string; timeZone: string; preferredCurrency: string; pronouns: string; relationshipStatus: string;
  avatarData: string; coverPhoto: string; wallets: Wallet[]; securityCodeSet: boolean; updatedAt: string | null; usernameChangedAt: string | null; namesChangedAt: string | null; nationalityChangedAt: string | null; phoneChangedAt: string | null; postalCodeChangedAt: string | null; regionChangedAt: string | null; genderChangedAt: string | null;
};
type Props = { user: { id: string; name: string; username: string; email: string; isEmailVerified: boolean } | null };
const API = (import.meta.env.VITE_API_BASE_URL || 'https://api.kingshall.online').replace(/\/$/, '');
/** Add ImageKit URL transformations only to URLs hosted beneath the configured ImageKit endpoint. */
function imageKitDeliveryUrl(url: string, transformations: string, endpoint: string): string {
  if (!url || !endpoint || !transformations) return url;
  try {
    const source = new URL(url);
    const base = new URL(endpoint);
    const basePath = base.pathname.replace(/\/+$/, '');
    if (source.origin !== base.origin || (basePath && source.pathname !== basePath && !source.pathname.startsWith(basePath + '/'))) return url;
    const relativePath = source.pathname.slice(basePath.length).replace(/^\/+/, '');
    if (!relativePath) return url;
    return base.origin + basePath + '/tr:' + transformations + '/' + relativePath + source.search + source.hash;
  } catch {
    return url;
  }
}
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Côte d’Ivoire','Croatia','Cuba','Cyprus','Czechia',
  'Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman',
  'Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar',
  'Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Türkiye','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen',
  'Zambia','Zimbabwe'
];
const SORTED_COUNTRIES = COUNTRIES.slice().sort((a, b) => a.localeCompare(b));
const CALLING_CODES: Record<string, string> = {
  'Afghanistan': '+93', 'Albania': '+355', 'Algeria': '+213', 'Andorra': '+376', 'Angola': '+244', 'Antigua and Barbuda': '+1 268', 'Argentina': '+54', 'Armenia': '+374', 'Australia': '+61', 'Austria': '+43', 'Azerbaijan': '+994',
  'Bahamas': '+1 242', 'Bahrain': '+973', 'Bangladesh': '+880', 'Barbados': '+1 246', 'Belarus': '+375', 'Belgium': '+32', 'Belize': '+501', 'Benin': '+229', 'Bhutan': '+975', 'Bolivia': '+591', 'Bosnia and Herzegovina': '+387', 'Botswana': '+267', 'Brazil': '+55', 'Brunei': '+673', 'Bulgaria': '+359', 'Burkina Faso': '+226', 'Burundi': '+257',
  'Cabo Verde': '+238', 'Cambodia': '+855', 'Cameroon': '+237', 'Canada': '+1', 'Central African Republic': '+236', 'Chad': '+235', 'Chile': '+56', 'China': '+86', 'Colombia': '+57', 'Comoros': '+269', 'Congo': '+242', 'Costa Rica': '+506', 'Côte d’Ivoire': '+225', 'Croatia': '+385', 'Cuba': '+53', 'Cyprus': '+357', 'Czechia': '+420',
  'Democratic Republic of the Congo': '+243', 'Denmark': '+45', 'Djibouti': '+253', 'Dominica': '+1 767', 'Dominican Republic': '+1 809', 'Ecuador': '+593', 'Egypt': '+20', 'El Salvador': '+503', 'Equatorial Guinea': '+240', 'Eritrea': '+291', 'Estonia': '+372', 'Eswatini': '+268', 'Ethiopia': '+251',
  'Fiji': '+679', 'Finland': '+358', 'France': '+33', 'Gabon': '+241', 'Gambia': '+220', 'Georgia': '+995', 'Germany': '+49', 'Ghana': '+233', 'Greece': '+30', 'Grenada': '+1 473', 'Guatemala': '+502', 'Guinea': '+224', 'Guinea-Bissau': '+245', 'Guyana': '+592',
  'Haiti': '+509', 'Honduras': '+504', 'Hungary': '+36', 'Iceland': '+354', 'India': '+91', 'Indonesia': '+62', 'Iran': '+98', 'Iraq': '+964', 'Ireland': '+353', 'Israel': '+972', 'Italy': '+39',
  'Jamaica': '+1 876', 'Japan': '+81', 'Jordan': '+962', 'Kazakhstan': '+7', 'Kenya': '+254', 'Kiribati': '+686', 'Kuwait': '+965', 'Kyrgyzstan': '+996', 'Laos': '+856', 'Latvia': '+371', 'Lebanon': '+961', 'Lesotho': '+266', 'Liberia': '+231', 'Libya': '+218', 'Liechtenstein': '+423', 'Lithuania': '+370', 'Luxembourg': '+352',
  'Madagascar': '+261', 'Malawi': '+265', 'Malaysia': '+60', 'Maldives': '+960', 'Mali': '+223', 'Malta': '+356', 'Marshall Islands': '+692', 'Mauritania': '+222', 'Mauritius': '+230', 'Mexico': '+52', 'Micronesia': '+691', 'Moldova': '+373', 'Monaco': '+377', 'Mongolia': '+976', 'Montenegro': '+382', 'Morocco': '+212', 'Mozambique': '+258', 'Myanmar': '+95',
  'Namibia': '+264', 'Nauru': '+674', 'Nepal': '+977', 'Netherlands': '+31', 'New Zealand': '+64', 'Nicaragua': '+505', 'Niger': '+227', 'Nigeria': '+234', 'North Korea': '+850', 'North Macedonia': '+389', 'Norway': '+47', 'Oman': '+968',
  'Pakistan': '+92', 'Palau': '+680', 'Palestine': '+970', 'Panama': '+507', 'Papua New Guinea': '+675', 'Paraguay': '+595', 'Peru': '+51', 'Philippines': '+63', 'Poland': '+48', 'Portugal': '+351', 'Qatar': '+974', 'Romania': '+40', 'Russia': '+7', 'Rwanda': '+250',
  'Saint Kitts and Nevis': '+1 869', 'Saint Lucia': '+1 758', 'Saint Vincent and the Grenadines': '+1 784', 'Samoa': '+685', 'San Marino': '+378', 'São Tomé and Príncipe': '+239', 'Saudi Arabia': '+966', 'Senegal': '+221', 'Serbia': '+381', 'Seychelles': '+248', 'Sierra Leone': '+232', 'Singapore': '+65', 'Slovakia': '+421', 'Slovenia': '+386', 'Solomon Islands': '+677', 'Somalia': '+252', 'South Africa': '+27', 'South Korea': '+82', 'South Sudan': '+211', 'Spain': '+34', 'Sri Lanka': '+94', 'Sudan': '+249', 'Suriname': '+597', 'Sweden': '+46', 'Switzerland': '+41', 'Syria': '+963',
  'Taiwan': '+886', 'Tajikistan': '+992', 'Tanzania': '+255', 'Thailand': '+66', 'Timor-Leste': '+670', 'Togo': '+228', 'Tonga': '+676', 'Trinidad and Tobago': '+1 868', 'Tunisia': '+216', 'Türkiye': '+90', 'Turkmenistan': '+993', 'Tuvalu': '+688', 'Uganda': '+256', 'Ukraine': '+380', 'United Arab Emirates': '+971', 'United Kingdom': '+44', 'United States': '+1', 'Uruguay': '+598', 'Uzbekistan': '+998',
  'Vanuatu': '+678', 'Vatican City': '+39 06', 'Venezuela': '+58', 'Vietnam': '+84', 'Yemen': '+967', 'Zambia': '+260', 'Zimbabwe': '+263'
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  'Bolivia': 'Bolivia, Plurinational State of',
  'Brunei': 'Brunei Darussalam',
  'Cabo Verde': 'Cape Verde',
  'Congo': 'Congo',
  'Côte d’Ivoire': "Côte d'Ivoire",
  'Czechia': 'Czech Republic',
  'Democratic Republic of the Congo': 'Congo, The Democratic Republic of the',
  'Iran': 'Iran, Islamic Republic of',
  'Laos': "Lao People's Democratic Republic",
  'Micronesia': 'Micronesia, Federated States of',
  'Moldova': 'Moldova, Republic of',
  'North Korea': "Korea, Democratic People's Republic of",
  'North Macedonia': 'Macedonia, the former Yugoslav Republic of',
  'Palestine': 'Palestine, State of',
  'Russia': 'Russian Federation',
  'South Korea': 'Korea, Republic of',
  'Syria': 'Syrian Arab Republic',
  'Taiwan': 'Taiwan, Province of China',
  'Tanzania': 'Tanzania, United Republic of',
  'Türkiye': 'Turkey',
  'Vatican City': 'Holy See (Vatican City State)',
  'Venezuela': 'Venezuela, Bolivarian Republic of',
  'Vietnam': 'Viet Nam'
};
function normalizeCountryName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function getRegionsForNationality(nationality: string): string[] {
  if (!nationality) return [];
  const countries = Country.getAllCountries();
  const alias = COUNTRY_NAME_ALIASES[nationality];
  const country = countries.find(item => item.name === alias)
    || countries.find(item => normalizeCountryName(item.name) === normalizeCountryName(nationality));
  if (!country) return [];
  return State.getStatesOfCountry(country.isoCode).map(item => item.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

type PostalCodeStatus = 'idle' | 'valid' | 'invalid' | 'not-required';
const COUNTRIES_WITHOUT_UNIVERSAL_POSTCODES = new Set(['Ghana', 'Qatar', 'United Arab Emirates']);
function validatePostalCode(nationality: string, value: string): PostalCodeStatus {
  const code = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!code || !nationality) return 'idle';
  if (COUNTRIES_WITHOUT_UNIVERSAL_POSTCODES.has(nationality)) return 'not-required';
  if (nationality === 'Nigeria') return /^\d{6}$/.test(code) ? 'valid' : 'invalid';
  if (nationality === 'United States') return /^\d{5}(?:-\d{4})?$/.test(code) ? 'valid' : 'invalid';
  if (nationality === 'United Kingdom') {
    const compact = code.replace(/\s/g, '');
    return /^(GIR0AA|(?:[A-Z]{1,2}\d[A-Z\d]?|[A-Z]{1,2}\d{2}|[A-Z]{1,2}\d[A-Z]|[A-Z]{1,2}\d{2}[A-Z])\d[A-Z]{2})$/.test(compact) ? 'valid' : 'invalid';
  }
  // General country-aware fallback: many national postal systems use 2–12
  // letters/digits with optional internal spaces or hyphens.
  return /^[A-Z0-9](?:[A-Z0-9 -]{0,10}[A-Z0-9])$/.test(code) && code.length >= 2 && code.length <= 12 ? 'valid' : 'invalid';
}

function cooldownDaysRemaining(changedAt: string | null | undefined, days: number): number {
  if (!changedAt) return 0;
  const remaining = new Date(changedAt).getTime() + days * 86400000 - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 86400000) : 0;
}
function capitalizeNameInput(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}
function formatDobInput(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(isoDate || '');
  return match ? match[3] + '/' + match[2] + '/' + match[1] : '';
}
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? '+' + digits : '';
}
function parseDobInput(value: string): string | null {
  if (!value.trim()) return '';
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const iso = match[3] + '-' + match[2] + '-' + match[1];
  return iso <= new Date().toISOString().slice(0, 10) ? iso : null;
}
function maskDobInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
}
function isAdultDob(isoDate: string): boolean {
  const dob = new Date(isoDate + 'T00:00:00.000Z');
  const today = new Date();
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday = today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age--;
  return age >= 18;
}
const blankProfile = (user: Props['user']): IdentityProfile => ({
  id: user?.id || '', firstName: '', middleName: '', lastName: '', username: user?.username || '', email: user?.email || '',
  emailVerified: Boolean(user?.isEmailVerified), memberSince: '', dateOfBirth: '', phone: '', phoneVerified: false, country: '',
  state: '', city: '', address: '', postalCode: '', nationality: '', gender: '', occupation: '',
  website: '', instagram: '', facebook: '', xHandle: '', telegram: '', discord: '', linkedin: '',
  language: '', timeZone: '', preferredCurrency: 'USD', pronouns: '', relationshipStatus: '',
  avatarData: '', coverPhoto: '', wallets: [], securityCodeSet: false, updatedAt: null, usernameChangedAt: null, namesChangedAt: null, nationalityChangedAt: null, phoneChangedAt: null, postalCodeChangedAt: null, regionChangedAt: null, genderChangedAt: null
});
async function request(path: string, body?: unknown) {
  const makeRequest = (token: string | null) => fetch(API + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  let response: Response;
  try { response = await makeRequest(sessionStorage.getItem('kh_access')); }
  catch { throw new Error('Could not reach ApiKingsHall. Check your connection and try again.'); }
  if (response.status === 401 && path !== '/api/auth/refresh') {
    const refreshToken = sessionStorage.getItem('kh_refresh');
    if (refreshToken) {
      try {
        const refresh = await fetch(API + '/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        const session = await refresh.json().catch(() => ({})) as { accessToken?: string; refreshToken?: string };
        if (refresh.ok && session.accessToken && session.refreshToken) {
          sessionStorage.setItem('kh_access', session.accessToken);
          sessionStorage.setItem('kh_refresh', session.refreshToken);
          response = await makeRequest(session.accessToken);
        }
      } catch { /* Keep the original API response so the user receives a useful error. */ }
    }
  }
  const data = await response.json().catch(() => ({})) as { profile?: IdentityProfile; message?: string; error?: string; securityCodeSet?: boolean; available?: boolean; validFormat?: boolean; providerAccepted?: boolean; token?: string; signature?: string; publicKey?: string; expire?: number; urlEndpoint?: string };
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
export default function IdentityPage({ user }: Props) {
  const [profile, setProfile] = useState<IdentityProfile>(() => blankProfile(user));
  const [dobInput, setDobInput] = useState('');
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');
  const [genderOpen, setGenderOpen] = useState(false);
  const [genderSearch, setGenderSearch] = useState('');
  const [imageKitEndpoint, setImageKitEndpoint] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalEditing, setPersonalEditing] = useState(false);
  const [personalBound, setPersonalBound] = useState(false);
  const [savingSocials, setSavingSocials] = useState(false);

  useEffect(() => {
    const closeCustomSelectors = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.kh-nationality-field')) return;
      setNationalityOpen(false);
      setRegionOpen(false);
      setGenderOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNationalityOpen(false);
        setRegionOpen(false);
        setGenderOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeCustomSelectors);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeCustomSelectors);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [nativePickerKind, setNativePickerKind] = useState<'profile' | 'cover' | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [photoCropSource, setPhotoCropSource] = useState<string | null>(null);
  const [coverCropSource, setCoverCropSource] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [coverActionsOpen, setCoverActionsOpen] = useState(false);
  const [deletePhotoConfirm, setDeletePhotoConfirm] = useState<'profile' | 'cover' | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    void request('/api/identity/imagekit-config').then(config => {
      if (active && config.urlEndpoint) setImageKitEndpoint(config.urlEndpoint.replace(/\/+$/, ''));
    }).catch(() => { /* Existing photos remain visible using their original URLs if ImageKit config is unavailable. */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const closePhotoPopouts = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('.kh-identity-photo-stack')) {
        setPhotoActionsOpen(false);
        setCoverActionsOpen(false);
        setDeletePhotoConfirm(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPhotoActionsOpen(false);
        setCoverActionsOpen(false);
        setDeletePhotoConfirm(null);
      }
    };
    document.addEventListener('pointerdown', closePhotoPopouts);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closePhotoPopouts);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'unsupported' | 'error'>('idle');
  const [emailChangePending, setEmailChangePending] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [verifyingEmailCode, setVerifyingEmailCode] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [phoneCodeSentFor, setPhoneCodeSentFor] = useState('');
  const [phoneVerifiedFor, setPhoneVerifiedFor] = useState('');
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [verifyingPhoneCode, setVerifyingPhoneCode] = useState(false);
  const savedEmailRef = useRef('');
  const savedProfileRef = useRef<IdentityProfile | null>(null);
  const parsedDobForStatus = parseDobInput(dobInput);
  const dobStatus: 'idle' | 'valid' | 'invalid' | 'underage' = !dobInput ? 'idle' : parsedDobForStatus === null ? 'invalid' : parsedDobForStatus === '' ? 'idle' : isAdultDob(parsedDobForStatus) ? 'valid' : 'underage';
  const regionOptions = getRegionsForNationality(profile.nationality);
  const selectedRegionIsValid = regionOptions.includes(profile.state);
  const postalCodeStatus = validatePostalCode(profile.nationality, profile.postalCode);
  const postalCodeMessage = postalCodeStatus === 'invalid'
    ? profile.nationality === 'Nigeria' ? 'Enter a six-digit Nigerian postcode.' : profile.nationality === 'United States' ? 'Enter a 5-digit ZIP code or ZIP+4 (12345-6789).' : profile.nationality === 'United Kingdom' ? 'Enter a valid UK postcode format, such as SW1A 1AA.' : 'Check the postal-code format for your selected nationality.'
    : postalCodeStatus === 'not-required' ? 'A universal postal-code system is not commonly used here; this field is optional.'
    : 'Postal-code format looks valid.';
  const usernameFeedback = !profile.username ? '' : profile.username.length < 3
    ? 'Use at least 3 characters.'
    : usernameStatus === 'checking' ? 'Checking username availability…'
    : usernameStatus === 'available' ? 'Username is available.'
    : usernameStatus === 'taken' ? 'That username is already taken.'
    : usernameStatus === 'error' ? 'Could not check availability. Try again.'
    : 'Use 3–24 letters or numbers.';
  const usernameFeedbackClass = usernameStatus === 'available' ? 'is-valid' : usernameStatus === 'taken' || usernameStatus === 'error' || (!!profile.username && profile.username.length < 3) ? 'is-invalid' : '';
  const emailFeedback = !profile.email ? '' : emailStatus === 'checking' ? 'Checking email address…'
    : emailStatus === 'available' ? 'Email format and provider accepted; address is available.'
    : emailStatus === 'taken' ? 'This email address is already in use.'
    : emailStatus === 'invalid' ? 'Enter a valid email address.'
    : emailStatus === 'unsupported' ? 'Use an email address from an accepted provider.'
    : emailStatus === 'error' ? 'Could not verify this email. Try again.'
    : '';
  const emailFeedbackClass = emailStatus === 'available' ? 'is-valid' : ['taken', 'invalid', 'unsupported', 'error'].includes(emailStatus) ? 'is-invalid' : '';
  const dobFeedback = !dobInput ? 'Enter your date of birth as DD/MM/YYYY; you must be at least 18.' : dobStatus === 'valid'
    ? 'Date format is valid and age requirement is met.'
    : dobStatus === 'underage' ? 'You must be at least 18 years old.'
    : 'Enter a real date in DD/MM/YYYY format.';
  const dobFeedbackClass = dobStatus === 'valid' ? 'is-valid' : dobStatus === 'invalid' || dobStatus === 'underage' ? 'is-invalid' : '';

  function update<K extends keyof IdentityProfile>(key: K, value: IdentityProfile[K]) { setProfile(old => ({ ...old, [key]: value } as IdentityProfile)); }
  useEffect(() => {
    const username = profile.username;
    if (loading || username.length < 3 || !/^[a-z0-9]{3,24}$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    let current = true;
    setUsernameStatus('checking');
    const timer = window.setTimeout(() => {
      request('/api/identity/username-availability?username=' + encodeURIComponent(username))
        .then(data => { if (current) setUsernameStatus(data.available ? 'available' : 'taken'); })
        .catch(() => { if (current) setUsernameStatus('error'); });
    }, 350);
    return () => { current = false; window.clearTimeout(timer); };
  }, [profile.username, loading, user?.id]);
  useEffect(() => {
    const email = profile.email;
    if (loading || !email) {
      setEmailStatus('idle');
      return;
    }
    // The current account already owns this address, so it must not be reported as taken.
    if (user?.email && email.toLowerCase() === user.email.trim().toLowerCase()) {
      setEmailStatus('available');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('invalid');
      return;
    }
    let current = true;
    setEmailStatus('checking');
    const timer = window.setTimeout(() => {
      request('/api/identity/email-availability?email=' + encodeURIComponent(email))
        .then(data => {
          if (!current) return;
          if (!data.validFormat) setEmailStatus('invalid');
          else if (!data.providerAccepted) setEmailStatus('unsupported');
          else setEmailStatus(data.available ? 'available' : 'taken');
        })
        .catch(() => { if (current) setEmailStatus('error'); });
    }, 350);
    return () => { current = false; window.clearTimeout(timer); };
  }, [profile.email, loading, user?.id]);
  useEffect(() => {
    let live = true;
    request('/api/identity').then(data => { if (live && data.profile) { setProfile(data.profile); savedProfileRef.current = { ...data.profile }; savedEmailRef.current = data.profile.email || ''; setDobInput(formatDobInput(data.profile.dateOfBirth)); const bound = Boolean(data.profile.dateOfBirth); setPersonalBound(bound); setPersonalEditing(!bound); } })
      .catch(error => { if (live) { setProfile(blankProfile(user)); setDobInput(''); setNotice(error.message || 'Could not load your identity.'); setNoticeOk(false); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.id]);
  async function saveSocials(): Promise<boolean> {
    if (savingSocials || savingPersonal) return false;
    setSavingSocials(true);
    setNotice('');
    try {
      const data = await request('/api/identity/socials', {
        website: profile.website, instagram: profile.instagram, facebook: profile.facebook,
        xHandle: profile.xHandle, telegram: profile.telegram, discord: profile.discord, linkedin: profile.linkedin
      });
      const savedProfile = data.profile;
      if (savedProfile) setProfile(old => ({ ...old,
        website: savedProfile.website || '', instagram: savedProfile.instagram || '',
        facebook: savedProfile.facebook || '', xHandle: savedProfile.xHandle || '',
        telegram: savedProfile.telegram || '', discord: savedProfile.discord || '',
        linkedin: savedProfile.linkedin || ''
      }));
      setNotice(data.message || 'Social links saved.');
      setNoticeOk(true);
      return true;
    } catch (error) {
      setNotice((error as Error).message || 'Could not save your social links.');
      setNoticeOk(false);
      return false;
    } finally { setSavingSocials(false); }
  }
  async function verifyEmailChange(): Promise<void> {
    const email = emailChangePending.trim().toLowerCase();
    const code = emailChangeCode.trim();
    if (!email || !/^\d{6}$/.test(code) || verifyingEmailCode || savingPersonal || savingSocials) {
      if (!/^\d{6}$/.test(code)) { setNotice('Enter the six-digit code sent to your new email address.'); setNoticeOk(false); }
      return;
    }
    setVerifyingEmailCode(true);
    setNotice('');
    try {
      const data = await request('/api/identity/email-change/verify', { email, code });
      savedEmailRef.current = email;
      setProfile(old => ({ ...old, email, emailVerified: true }));
      setEmailChangePending('');
      setEmailChangeCode('');
      setNotice(data.message || 'Email verified successfully. Saving your personal details…');
      setNoticeOk(true);
      await savePersonal(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not verify the new email address.');
      setNoticeOk(false);
    } finally { setVerifyingEmailCode(false); }
  }

  async function sendPhoneVerificationCode(): Promise<void> {
    const phone = normalizePhone(profile.phone);
    if (!/^\\+[1-9]\\d{7,14}$/.test(phone)) {
      setNotice('Enter a valid mobile number with its country calling code first.');
      setNoticeOk(false);
      return;
    }
    if (sendingPhoneCode || verifyingPhoneCode || savingPersonal || savingSocials) return;
    setSendingPhoneCode(true);
    setNotice('');
    try {
      const data = await request('/api/identity/phone-verification/request', { phone });
      if (data.verified) {
        setPhoneVerifiedFor(phone);
        setPhoneCodeSentFor('');
        setPhoneVerificationCode('');
      } else {
        setPhoneCodeSentFor(phone);
        setPhoneVerificationCode('');
      }
      setNotice(data.message || 'A WhatsApp verification code has been sent.');
      setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not send the WhatsApp verification code.');
      setNoticeOk(false);
    } finally { setSendingPhoneCode(false); }
  }

  async function verifyPhoneVerificationCode(): Promise<void> {
    const phone = normalizePhone(profile.phone);
    const code = phoneVerificationCode.trim();
    if (!/^\\d{6}$/.test(code)) {
      setNotice('Enter the six-digit code sent to your WhatsApp.');
      setNoticeOk(false);
      return;
    }
    if (phone !== phoneCodeSentFor || verifyingPhoneCode || sendingPhoneCode || savingPersonal || savingSocials) return;
    setVerifyingPhoneCode(true);
    setNotice('');
    try {
      const data = await request('/api/identity/phone-verification/verify', { phone, code });
      setPhoneVerifiedFor(phone);
      setPhoneVerificationCode('');
      setNotice(data.message || 'Phone number verified. You can now save your Personal details.');
      setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not verify this phone number.');
      setNoticeOk(false);
    } finally { setVerifyingPhoneCode(false); }
  }

  async function savePersonal(emailAlreadyVerified = false): Promise<boolean> {
    if (savingPersonal || savingSocials) return false;
    const parsedDob = parseDobInput(dobInput);
    if (!profile.firstName.trim() || !profile.lastName.trim() ||
        !profile.phone.trim() || !profile.nationality || !profile.state.trim() ||
        !profile.postalCode.trim()) {
      setNotice('Complete every field in the Personal section before saving.');
      setNoticeOk(false);
      return false;
    }
    const normalizedPhoneDraft = normalizePhone(profile.phone);
    const existingVerifiedPhone = Boolean(profile.phoneVerified && savedProfileRef.current &&
      normalizePhone(savedProfileRef.current.phone) === normalizedPhoneDraft);
    if (!existingVerifiedPhone && phoneVerifiedFor !== normalizedPhoneDraft) {
      setNotice('Verify this mobile number through WhatsApp before saving your Personal details.');
      setNoticeOk(false);
      return false;
    }
    if (parsedDob === null || parsedDob === '' || !isAdultDob(parsedDob)) {
      setNotice(parsedDob === null ? 'Enter your date of birth as DD/MM/YYYY using a real date that is not in the future.' : parsedDob === '' ? 'Enter your date of birth to confirm you are at least 18.' : 'You must be at least 18 years old to save your identity.');
      setNoticeOk(false);
      return false;
    }
    const usernameUnchanged = savedProfileRef.current?.username === profile.username;
    if (!/^[a-z0-9]{3,24}$/.test(profile.username) || (!usernameUnchanged && usernameStatus !== 'available')) {
      setNotice(usernameStatus === 'taken' ? 'That username is already taken. Choose another one.' : usernameStatus === 'checking' ? 'Please wait while we check username availability.' : usernameStatus === 'error' ? 'Could not verify username availability. Try again.' : 'Choose a valid username and wait for its availability check.');
      setNoticeOk(false);
      return false;
    }
    const emailUnchanged = savedProfileRef.current?.email?.trim().toLowerCase() === profile.email.trim().toLowerCase();
    if (!profile.email || (!emailUnchanged && !emailAlreadyVerified && emailStatus !== 'available')) {
      setNotice(emailStatus === 'invalid' ? 'Enter a valid email address.' : emailStatus === 'unsupported' ? 'Please use an email address from an accepted email provider.' : emailStatus === 'taken' ? 'That email address is already in use.' : emailStatus === 'checking' ? 'Please wait while we check your email address.' : emailStatus === 'error' ? 'Could not verify your email address. Try again.' : 'Enter an email address from an accepted provider and wait for its check.');
      setNoticeOk(false);
      return false;
    }
    if (postalCodeStatus === 'invalid' && (!savedProfileRef.current || profile.postalCode !== savedProfileRef.current.postalCode)) {
      setNotice('Check the postal code format for your selected nationality before saving.');
      setNoticeOk(false);
      return false;
    }
    if (!['Female', 'Male', 'Non-binary', 'Other'].includes(profile.gender)) {
      setNotice('Select your gender before saving your personal details.');
      setNoticeOk(false);
      return false;
    }
    const regionUnchanged = savedProfileRef.current?.state === profile.state && savedProfileRef.current?.nationality === profile.nationality;
    if (!regionUnchanged && (!profile.nationality || !regionOptions.length || !selectedRegionIsValid)) {
      setNotice(!profile.nationality ? 'Select your nationality first.' : !regionOptions.length ? 'No region options are available for this nationality. Please contact support before saving your personal details.' : 'Select a valid state or region for your nationality.');
      setNoticeOk(false);
      return false;
    }
    if (profile.email.trim().toLowerCase() !== savedEmailRef.current.trim().toLowerCase()) {
      setSavingPersonal(true);
      setNotice('');
      try {
        const sent = await request('/api/identity/email-change/request', { email: profile.email.trim().toLowerCase() });
        setEmailChangePending(profile.email.trim().toLowerCase());
        setEmailChangeCode('');
        setNotice(sent.message || 'A verification code has been sent to your new email address.');
        setNoticeOk(true);
      } catch (error) {
        setNotice((error as Error).message || 'Could not send an email verification code.');
        setNoticeOk(false);
      } finally { setSavingPersonal(false); }
      return false;
    }
    setSavingPersonal(true);
    setNotice('');
    try {
      const currentValues = { firstName: profile.firstName, middleName: profile.middleName, lastName: profile.lastName,
        username: profile.username, email: profile.email, dateOfBirth: parsedDob, phone: profile.phone,
        nationality: profile.nationality, state: profile.state, postalCode: profile.postalCode,
        gender: profile.gender };
      const saved = savedProfileRef.current;
      const changedValues: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(currentValues)) {
        const oldValue = (saved as unknown as Record<string, unknown> | null)?.[key];
        if (!saved || String(oldValue ?? '') !== String(value ?? '')) changedValues[key] = value;
      }
      if (Object.keys(changedValues).length === 0) {
        setNotice('No changes to save.'); setNoticeOk(true); return true;
      }
      const data = await request('/api/identity/personal', changedValues);
      const savedProfile = data.profile;
      if (savedProfile) {
        savedProfileRef.current = { ...savedProfile };
        savedEmailRef.current = savedProfile.email || savedEmailRef.current;
        setEmailChangePending('');
        setEmailChangeCode('');
        setProfile(old => ({ ...old,
          firstName: savedProfile.firstName, middleName: savedProfile.middleName, lastName: savedProfile.lastName,
          username: savedProfile.username, email: savedProfile.email, dateOfBirth: savedProfile.dateOfBirth,
          phone: savedProfile.phone, state: savedProfile.state, postalCode: savedProfile.postalCode,
          nationality: savedProfile.nationality, gender: savedProfile.gender,
          usernameChangedAt: savedProfile.usernameChangedAt, namesChangedAt: savedProfile.namesChangedAt,
          nationalityChangedAt: savedProfile.nationalityChangedAt, phoneChangedAt: savedProfile.phoneChangedAt, postalCodeChangedAt: savedProfile.postalCodeChangedAt, regionChangedAt: savedProfile.regionChangedAt, genderChangedAt: savedProfile.genderChangedAt
        }));
        setDobInput(formatDobInput(savedProfile.dateOfBirth));
      }
      setNotice(data.message || 'Personal details saved.');
      setNoticeOk(true);
      setPersonalBound(true);
      setPersonalEditing(false);
      return true;
    } catch (error) {
      setNotice((error as Error).message || 'Could not save your personal details.');
      setNoticeOk(false);
      return false;
    } finally { setSavingPersonal(false); }
  }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>, kind: 'profile' | 'cover') {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setNotice('Choose an image file.'); setNoticeOk(false); return; }
    if (file.size > 10 * 1024 * 1024) { setNotice('Choose an image smaller than 10 MB.'); setNoticeOk(false); return; }
    const source = URL.createObjectURL(file);
    if (kind === 'profile') setPhotoCropSource(source); else setCoverCropSource(source);
    setNotice('');
  }
  async function uploadCroppedPhoto(file: File, kind: 'profile' | 'cover') {
    const source = kind === 'profile' ? photoCropSource : coverCropSource;
    if (source) URL.revokeObjectURL(source);
    setPhotoCropSource(null); setCoverCropSource(null);
    if (kind === 'profile') setPhotoBusy(true); else setCoverBusy(true);
    setNotice('');
    try {
      const auth = await request('/api/identity/imagekit-auth') as { token?: string; signature?: string; publicKey?: string; expire?: number; urlEndpoint?: string };
      if (auth.urlEndpoint) setImageKitEndpoint(auth.urlEndpoint.replace(/\/+$/, ''));
      if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) throw new Error('Image upload authentication is incomplete. Check the KingsHall API ImageKit setup.');
      const formData = new FormData();
      formData.append('file', file, kind === 'profile' ? 'profile-picture.jpg' : 'cover-photo.jpg');
      formData.append('fileName', `kingshall-${kind}-${profile.id || 'member'}-${Date.now()}.jpg`);
      formData.append('publicKey', auth.publicKey); formData.append('token', auth.token);
      formData.append('signature', auth.signature); formData.append('expire', String(auth.expire));
      formData.append('useUniqueFileName', 'true');
      const uploaded = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
      const result = await uploaded.json().catch(() => ({})) as { url?: string; message?: string };
      if (!uploaded.ok || !result.url) throw new Error(result.message || 'ImageKit could not upload this photo.');
      const savedResponse = await request('/api/identity/photos', {
        avatarData: kind === 'profile' ? result.url : (profile.avatarData || ''),
        coverPhoto: kind === 'cover' ? result.url : (profile.coverPhoto || '')
      });
      if (savedResponse.profile) setProfile(old => ({ ...old, avatarData: savedResponse.profile!.avatarData || '', coverPhoto: savedResponse.profile!.coverPhoto || '' }));
      setNotice(kind === 'profile' ? 'Profile picture updated.' : 'Cover photo updated.'); setNoticeOk(true);
    } catch (error) {
      setNotice((error as Error).message || 'Could not upload this photo.'); setNoticeOk(false);
    } finally { setPhotoBusy(false); setCoverBusy(false); }
  }
  async function deletePhoto(kind: 'profile' | 'cover') {
    setDeletePhotoConfirm(null); setPhotoActionsOpen(false); setCoverActionsOpen(false);
    try {
      const savedResponse = await request('/api/identity/photos', {
        avatarData: kind === 'profile' ? '' : (profile.avatarData || ''),
        coverPhoto: kind === 'cover' ? '' : (profile.coverPhoto || '')
      });
      if (savedResponse.profile) setProfile(old => ({ ...old, avatarData: savedResponse.profile!.avatarData || '', coverPhoto: savedResponse.profile!.coverPhoto || '' }));
      setNotice(kind === 'profile' ? 'Profile picture removed.' : 'Cover photo removed.'); setNoticeOk(true);
    } catch (error) { setNotice((error as Error).message || 'Could not remove this photo.'); setNoticeOk(false); }
  }
  const usernameDaysLeft = cooldownDaysRemaining(profile.usernameChangedAt, 30);
  const namesDaysLeft = cooldownDaysRemaining(profile.namesChangedAt, 30);
  const nationalityDaysLeft = cooldownDaysRemaining(profile.nationalityChangedAt, 7);
  const phoneDaysLeft = cooldownDaysRemaining(profile.phoneChangedAt, 7);
  const postalDaysLeft = cooldownDaysRemaining(profile.postalCodeChangedAt, 7);
  const regionDaysLeft = cooldownDaysRemaining(profile.regionChangedAt, 7);
  const genderDaysLeft = cooldownDaysRemaining(profile.genderChangedAt, 60);
  const storedPhoneCode = phoneDaysLeft > 0 ? Object.values(CALLING_CODES).sort((a, b) => b.length - a.length).find(code => profile.phone.startsWith(code)) : '';
  const phoneCallingCode = storedPhoneCode || CALLING_CODES[profile.nationality] || '';
  const phoneInputValue = phoneCallingCode && profile.phone.startsWith(phoneCallingCode)
    ? profile.phone.slice(phoneCallingCode.length).trim()
    : profile.phone;
  return <div className="kh-identity-page">
    <div className="kh-identity-heading">
      <span className="eyebrow"><span className="eyebrow-line" />CENTRAL MEMBER RECORD</span>
      <h1>KingsHall <em>Identity.</em></h1>
      <p>Your central profile for KingsHall and connected applications. Add the details you want KingsHall to securely retain.</p>
    </div>
    <Toast message={notice} tone={noticeOk ? 'success' : 'error'} onClose={() => setNotice('')} />

      <form className="kh-identity-form" onSubmit={event => event.preventDefault()}>
        <section className="kh-identity-card kh-identity-personal">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Personal{loading && <span className="kh-identity-section-loading" aria-label="Loading personal details"><LoadingDots /></span>}</h2><p>Core details connected to your KingsHall account.</p></div></div>
          <div className="kh-identity-photo-stack">
            <div className="kh-identity-cover-frame">
              <button type="button" className="kh-identity-cover-trigger" aria-label="Cover photo actions" aria-expanded={coverActionsOpen} onClick={() => { setCoverActionsOpen(open => !open); setPhotoActionsOpen(false); setDeletePhotoConfirm(null); }} disabled={coverBusy || photoBusy}>
                {profile.coverPhoto ? <img src={imageKitDeliveryUrl(profile.coverPhoto, "w-1600,h-520,fo-auto", imageKitEndpoint)} alt="Your cover photo" /> : <span className="kh-identity-cover-empty"><span className="kh-photo-symbol">▧</span><small>Cover photo</small></span>}
                <span className="kh-identity-cover-hint">{coverBusy ? 'Uploading…' : 'Cover photo options'}</span>
              </button>
              {coverActionsOpen && <div className="kh-photo-popout kh-photo-popout-cover" role="group" aria-label="Cover photo actions">
                <button type="button" onClick={() => { setCoverActionsOpen(false); if (isNativeGalleryAvailable()) setNativePickerKind('cover'); else coverInputRef.current?.click(); }}><PhotoActionGlyph type="upload" /> Upload</button>
                <button type="button" disabled={!profile.coverPhoto} onClick={() => { setCoverActionsOpen(false); setCoverPreview(profile.coverPhoto); }}><PhotoActionGlyph type="view" /> View</button>
                <button type="button" className="is-danger" disabled={!profile.coverPhoto} onClick={() => setDeletePhotoConfirm('cover')}><PhotoActionGlyph type="delete" /> Delete</button>
              </div>}
              {deletePhotoConfirm === 'cover' && <div className="kh-photo-confirm" role="alertdialog"><strong>Delete cover photo?</strong><div><button type="button" onClick={() => setDeletePhotoConfirm(null)}>Cancel</button><button type="button" className="is-danger" onClick={() => void deletePhoto('cover')}>Delete</button></div></div>}
            </div>
            <div className="kh-identity-avatar-wrap">
              <button type="button" className="kh-identity-avatar kh-identity-avatar-trigger" aria-label="Profile picture actions" aria-expanded={photoActionsOpen} onClick={() => { setPhotoActionsOpen(open => !open); setCoverActionsOpen(false); setDeletePhotoConfirm(null); }} disabled={photoBusy || coverBusy}>
                {profile.avatarData ? <img src={imageKitDeliveryUrl(profile.avatarData, "w-320,h-320,fo-auto", imageKitEndpoint)} alt="Your profile" /> : <span>{(profile.firstName || 'K').trim().charAt(0).toUpperCase()}</span>}
              </button>
              {photoActionsOpen && <div className="kh-photo-popout kh-photo-popout-avatar" role="group" aria-label="Profile picture actions">
                <button type="button" onClick={() => { setPhotoActionsOpen(false); if (isNativeGalleryAvailable()) setNativePickerKind('profile'); else photoInputRef.current?.click(); }}><span>↑</span> Upload</button>
                <button type="button" disabled={!profile.avatarData} onClick={() => { setPhotoActionsOpen(false); setPhotoPreview(profile.avatarData); }}><span>◉</span> View</button>
                <button type="button" className="is-danger" disabled={!profile.avatarData} onClick={() => setDeletePhotoConfirm('profile')}><span>×</span> Delete</button>
              </div>}
              {deletePhotoConfirm === 'profile' && <div className="kh-photo-confirm kh-photo-confirm-avatar" role="alertdialog"><strong>Delete profile picture?</strong><div><button type="button" onClick={() => setDeletePhotoConfirm(null)}>Cancel</button><button type="button" className="is-danger" onClick={() => void deletePhoto('profile')}>Delete</button></div></div>}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" hidden aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} onChange={event => selectPhoto(event, 'profile')} />
            <input ref={coverInputRef} type="file" accept="image/*" hidden aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} onChange={event => selectPhoto(event, 'cover')} />
          </div>
          <fieldset className="kh-identity-editable-fields" disabled={!personalEditing || loading || personalBound}>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-first-name">First name</label><input id="identity-first-name" disabled={namesDaysLeft > 0} maxLength={80} autoComplete="given-name" value={profile.firstName} onChange={e => update('firstName', capitalizeNameInput(e.target.value))} required />{personalEditing && namesDaysLeft > 0 && <small className="kh-postal-feedback">All three name fields unlock in {namesDaysLeft} day(s).</small>}</div>
            <div className="field"><label htmlFor="identity-middle-name">Middle name <span className="optional">(if any)</span></label><input id="identity-middle-name" disabled={namesDaysLeft > 0} maxLength={80} autoComplete="additional-name" value={profile.middleName} onChange={e => update('middleName', capitalizeNameInput(e.target.value))} /></div>
            <div className="field"><label htmlFor="identity-last-name">Last name</label><input id="identity-last-name" disabled={namesDaysLeft > 0} maxLength={80} autoComplete="family-name" value={profile.lastName} onChange={e => update('lastName', capitalizeNameInput(e.target.value))} required /></div>
            <div className={`field kh-username-field is-${personalEditing ? usernameStatus : 'idle'}`}><label htmlFor="identity-username">KingsHall username</label><div className="kh-username-input-wrap"><input id="identity-username" type="text" disabled={usernameDaysLeft > 0} minLength={3} maxLength={24} pattern="[a-z0-9]{3,24}" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profile.username} onChange={e => update('username', e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())} required />{personalEditing && profile.username.length > 0 && (usernameStatus === 'checking' ? <span className="kh-username-spinner kh-username-indicator" role="status" aria-label="Checking username availability" /> : usernameStatus === 'available' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Username available"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : usernameStatus === 'taken' ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Username unavailable"><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div>{personalEditing && usernameFeedback && <small className={`kh-postal-feedback ${usernameFeedbackClass}`}>{usernameFeedback}</small>}{personalEditing && usernameDaysLeft > 0 && <small className="kh-postal-feedback">Username unlocks in {usernameDaysLeft} day(s).</small>}</div>
            <div className={`field kh-email-field is-${personalEditing ? emailStatus : 'idle'}`}><label htmlFor="identity-email">Email address</label><div className="kh-email-input-wrap"><input id="identity-email" type="email" maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={profile.email} onChange={e => update('email', e.target.value.toLowerCase().replace(/\s/g, ''))} required />{personalEditing && profile.email.length > 0 && (emailStatus === 'checking' ? <span className="kh-username-spinner kh-username-indicator" role="status" aria-label="Checking email address" /> : emailStatus === 'available' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Email accepted and available"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : ['taken', 'invalid', 'unsupported', 'error'].includes(emailStatus) ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Email invalid or unavailable"><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div>{personalEditing && emailFeedback && <small className={`kh-postal-feedback ${emailFeedbackClass}`}>{emailFeedback}</small>}{personalEditing && emailChangePending === profile.email.trim().toLowerCase() && <div className="kh-email-change-verification"><label htmlFor="identity-email-change-code">Verification code</label><input id="identity-email-change-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit code" value={emailChangeCode} onChange={e => setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><button className="submit-button" type="button" onClick={() => void verifyEmailChange()} disabled={verifyingEmailCode || savingPersonal || savingSocials || emailChangeCode.length !== 6}>{verifyingEmailCode ? <LoadingDots /> : 'Verify Email'}</button><small className="kh-postal-feedback">Check your new inbox for the six-digit code. It expires in 10 minutes.</small></div>}</div>
          </div>
          <div className="kh-identity-grid">
            <div className={`field kh-dob-field is-${personalEditing ? dobStatus : 'idle'}`}><label htmlFor="identity-dob">Date of birth</label><div className="kh-username-input-wrap"><input id="identity-dob" type="text" disabled={Boolean(profile.dateOfBirth)} inputMode="numeric" autoComplete="bday" placeholder="DD/MM/YYYY" maxLength={10} value={dobInput} aria-invalid={personalEditing && (dobStatus === 'invalid' || dobStatus === 'underage')} onChange={e => { const value = maskDobInput(e.target.value); setDobInput(value); const parsed = parseDobInput(value); update('dateOfBirth', typeof parsed === 'string' ? parsed : ''); }} />{personalEditing && (dobStatus === 'valid' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Date of birth verified: 18 or older"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : dobStatus === 'invalid' || dobStatus === 'underage' ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label={dobStatus === 'underage' ? 'Must be at least 18 years old' : 'Enter a valid date of birth' }><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div>{personalEditing && <small className={`kh-postal-feedback ${dobFeedbackClass}`}>{dobFeedback}</small>}{personalEditing && profile.dateOfBirth && <small className="kh-postal-feedback">Date of birth is permanently locked after its first save.</small>}</div>
            <div className={`field kh-nationality-field kh-country-field${nationalityOpen ? ' is-open' : ''}`}><label id="identity-nationality-label">Nationality</label><button className="kh-nationality-trigger" type="button" aria-labelledby="identity-nationality-label" aria-haspopup="listbox" aria-expanded={nationalityOpen} disabled={nationalityDaysLeft > 0 || regionDaysLeft > 0} onClick={() => { setNationalityOpen(open => !open); setNationalitySearch(''); }}><span className={profile.nationality ? '' : 'is-placeholder'}>{profile.nationality || 'Select nationality'}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>{personalEditing && nationalityDaysLeft > 0 && <small className="kh-postal-feedback">Nationality unlocks in {nationalityDaysLeft} day(s).</small>}{nationalityOpen && <div className="kh-nationality-popout"><input className="kh-nationality-search" type="search" aria-label="Search countries" placeholder="Search countries…" autoComplete="off" value={nationalitySearch} onChange={e => setNationalitySearch(e.target.value)} /><div className="kh-nationality-list" role="listbox" aria-label="Countries in alphabetical order">{SORTED_COUNTRIES.filter(country => country.toLowerCase().includes(nationalitySearch.trim().toLowerCase())).map(country => <button type="button" role="option" aria-selected={profile.nationality === country} className="kh-nationality-option" key={country} onClick={() => {
  const nextCode = CALLING_CODES[country];
  const previousCode = CALLING_CODES[profile.nationality];
  update('nationality', country);
  const nextRegions = getRegionsForNationality(country);
  if (!nextRegions.includes(profile.state)) update('state', '');
  if (nextCode && phoneDaysLeft === 0) {
    const currentPhone = profile.phone.trim();
    let nationalPart = currentPhone;
    if (previousCode && currentPhone.startsWith(previousCode)) nationalPart = currentPhone.slice(previousCode.length).trim();
    else if (/^\+\d/.test(currentPhone)) nationalPart = currentPhone.replace(/^\+\d{1,4}[\s-]*/, '');
    else nationalPart = currentPhone.replace(/^0+/, '');
    update('phone', nationalPart ? nextCode + ' ' + nationalPart : nextCode + ' ');
  }
  setNationalityOpen(false);
  setNationalitySearch('');
}}>{country}{profile.nationality === country && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}</button>)}{SORTED_COUNTRIES.filter(country => country.toLowerCase().includes(nationalitySearch.trim().toLowerCase())).length === 0 && <p className="kh-nationality-empty">No matching country found.</p>}</div></div>}</div>
            <div className="field kh-phone-field"><label htmlFor="identity-phone">Mobile Number</label><div className="kh-phone-input-wrap"><span className="kh-phone-code" aria-label={phoneCallingCode ? 'Country calling code ' + phoneCallingCode : 'Select a nationality to set the calling code'}>{phoneCallingCode || 'Code'}</span><input id="identity-phone" type="tel" disabled={phoneDaysLeft > 0} inputMode="tel" autoComplete="tel-national" maxLength={32} placeholder={phoneCallingCode ? 'Enter your number' : 'Select nationality first'} value={phoneInputValue} onChange={e => { const nextPhone = phoneCallingCode ? phoneCallingCode + ' ' + e.target.value.replace(/^\\s+/, '') : e.target.value; if (normalizePhone(nextPhone) !== normalizePhone(profile.phone)) { setPhoneVerificationCode(''); setPhoneCodeSentFor(''); setPhoneVerifiedFor(''); } update('phone', nextPhone); }} /></div>{personalEditing && phoneDaysLeft > 0 && <small className="kh-postal-feedback">Mobile number unlocks in {phoneDaysLeft} day(s).</small>}{personalEditing && phoneDaysLeft === 0 && <div className="kh-phone-verification">{(phoneVerifiedFor === normalizePhone(profile.phone) || (profile.phoneVerified && savedProfileRef.current && normalizePhone(savedProfileRef.current.phone) === normalizePhone(profile.phone))) ? <p className="kh-phone-verification-status is-verified"><span aria-hidden="true">✓</span> WhatsApp number verified</p> : <>{phoneCodeSentFor === normalizePhone(profile.phone) && <label htmlFor="identity-phone-verification-code">WhatsApp verification code</label>}{phoneCodeSentFor === normalizePhone(profile.phone) && <input id="identity-phone-verification-code" className="kh-phone-verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter 6-digit code" value={phoneVerificationCode} onChange={e => setPhoneVerificationCode(e.target.value.replace(/\\D/g, '').slice(0, 6))} />}<div className="kh-phone-verification-actions">{phoneCodeSentFor === normalizePhone(profile.phone) ? <button type="button" className="submit-button" disabled={verifyingPhoneCode || sendingPhoneCode || phoneVerificationCode.length !== 6} onClick={() => void verifyPhoneVerificationCode()}>{verifyingPhoneCode ? 'Verifying…' : 'Verify code'}</button> : null}<button type="button" className="submit-button" disabled={sendingPhoneCode || verifyingPhoneCode || !/^\\+[1-9]\\d{7,14}$/.test(normalizePhone(profile.phone))} onClick={() => void sendPhoneVerificationCode()}>{sendingPhoneCode ? 'Sending…' : phoneCodeSentFor === normalizePhone(profile.phone) ? 'Resend code' : 'Send WhatsApp code'}</button></div></>}</div>}</div>
            <div className={`field kh-nationality-field kh-region-field${regionOpen ? ' is-open' : ''}`}><label id="identity-state-label">State / Region</label><button className="kh-nationality-trigger" type="button" aria-labelledby="identity-state-label" aria-haspopup="listbox" aria-expanded={regionOpen} disabled={!profile.nationality || regionOptions.length === 0 || regionDaysLeft > 0} onClick={() => { setRegionOpen(open => !open); setRegionSearch(''); }}><span className={profile.state ? '' : 'is-placeholder'}>{profile.state || (!profile.nationality ? 'Select nationality first' : regionOptions.length ? 'Select state or region' : 'No regions available')}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>{personalEditing && regionDaysLeft > 0 && <small className="kh-postal-feedback">State / Region unlocks in {regionDaysLeft} day(s).</small>}{regionOpen && <div className="kh-nationality-popout"><input className="kh-nationality-search" type="search" aria-label="Search states or regions" placeholder="Search states or regions…" autoComplete="off" value={regionSearch} onChange={e => setRegionSearch(e.target.value)} /><div className="kh-nationality-list" role="listbox" aria-label="States and regions in alphabetical order">{regionOptions.filter(region => region.toLowerCase().includes(regionSearch.trim().toLowerCase())).map(region => <button type="button" role="option" aria-selected={profile.state === region} className="kh-nationality-option" key={region} onClick={() => { update('state', region); setRegionOpen(false); setRegionSearch(''); }}>{region}{profile.state === region && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}</button>)}{regionOptions.filter(region => region.toLowerCase().includes(regionSearch.trim().toLowerCase())).length === 0 && <p className="kh-nationality-empty">No matching state or region found.</p>}</div></div>}</div>
            <div className={`field kh-postal-field is-${personalEditing ? postalCodeStatus : 'idle'}`}><label htmlFor="identity-postal">Postal code</label><div className="kh-postal-input-wrap"><input id="identity-postal" disabled={postalDaysLeft > 0} maxLength={12} autoComplete="postal-code" autoCapitalize="characters" spellCheck={false} placeholder={profile.nationality === 'Nigeria' ? 'e.g. 100001' : profile.nationality === 'United States' ? 'e.g. 10001 or 10001-1234' : profile.nationality === 'United Kingdom' ? 'e.g. SW1A 1AA' : 'Postal code'} value={profile.postalCode} onChange={e => update('postalCode', e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/ {2,}/g, ' ').slice(0, 12))} />{personalEditing && profile.postalCode.trim() && (postalCodeStatus === 'valid' ? <svg className="kh-username-check kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Postal code format valid"><circle cx="10" cy="10" r="8.25" /><path d="m5.8 10.2 2.7 2.7 5.7-6" /></svg> : postalCodeStatus === 'invalid' ? <svg className="kh-username-unavailable kh-username-indicator" viewBox="0 0 20 20" fill="none" role="img" aria-label="Postal code format invalid"><circle cx="10" cy="10" r="8.25" /><path d="m7 7 6 6M13 7l-6 6" /></svg> : null)}</div>{personalEditing && postalCodeStatus === 'invalid' && <small className="kh-postal-feedback is-invalid">{postalCodeMessage}</small>}{personalEditing && postalCodeStatus === 'not-required' && <small className="kh-postal-feedback">{postalCodeMessage}</small>}{personalEditing && postalCodeStatus === 'valid' && <small className="kh-postal-feedback is-valid">{postalCodeMessage}</small>}{personalEditing && postalDaysLeft > 0 && <small className="kh-postal-feedback">Postal code unlocks in {postalDaysLeft} day(s).</small>}</div>
            <div className="field kh-nationality-field kh-gender-field"><label id="identity-gender-label">Gender</label><button className="kh-nationality-trigger" type="button" aria-labelledby="identity-gender-label" aria-haspopup="listbox" aria-expanded={genderOpen} disabled={genderDaysLeft > 0} onClick={() => { setGenderOpen(open => !open); setGenderSearch(''); }}><span className={profile.gender ? '' : 'is-placeholder'}>{profile.gender || 'Select gender'}</span><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg></button>{personalEditing && genderDaysLeft > 0 && <small className="kh-postal-feedback">Gender unlocks in {genderDaysLeft} day(s).</small>}{genderOpen && <div className="kh-nationality-popout"><input className="kh-nationality-search" type="search" aria-label="Search gender options" placeholder="Search gender…" autoComplete="off" value={genderSearch} onChange={e => setGenderSearch(e.target.value)} /><div className="kh-nationality-list" role="listbox" aria-label="Gender options">{['Female', 'Male', 'Non-binary', 'Other'].filter(gender => gender.toLowerCase().includes(genderSearch.trim().toLowerCase())).map(gender => <button type="button" role="option" aria-selected={profile.gender === gender} className="kh-nationality-option" key={gender} onClick={() => { update('gender', gender); setGenderOpen(false); setGenderSearch(''); }}>{gender}{profile.gender === gender && <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg>}</button>)}{['Female', 'Male', 'Non-binary', 'Other'].filter(gender => gender.toLowerCase().includes(genderSearch.trim().toLowerCase())).length === 0 && <p className="kh-nationality-empty">No matching gender option found.</p>}</div></div>}</div>
          </div>
          </fieldset>
          {!personalBound && personalEditing && <div className="kh-identity-section-save"><span>Bind your personal details once. After the first successful save, they stay locked.</span><button className="submit-button" type="button" onClick={() => void savePersonal()} disabled={savingPersonal || savingSocials || loading}>{savingPersonal ? <LoadingDots /> : 'Save Personal'}</button></div>}
        </section>
        <section className="kh-identity-card">
          <div className="kh-identity-card-head"><span className="kh-home-card-icon"><FeatureIconPlaceholder type="person" /></span><div><h2>Socials</h2><p>Optional public profiles and social contact handles.</p></div></div>
          <fieldset className="kh-identity-editable-fields" disabled={loading}>
          <div className="kh-identity-grid">
            <div className="field"><label htmlFor="identity-website">Website</label><input id="identity-website" type="url" maxLength={240} placeholder="https://…" value={profile.website} onChange={e => update('website', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-instagram">Instagram</label><input id="identity-instagram" maxLength={100} placeholder="@username or profile URL" value={profile.instagram} onChange={e => update('instagram', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-facebook">Facebook</label><input id="identity-facebook" maxLength={160} placeholder="Profile URL or name" value={profile.facebook} onChange={e => update('facebook', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-x">X / Twitter</label><input id="identity-x" maxLength={100} placeholder="@username or profile URL" value={profile.xHandle} onChange={e => update('xHandle', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-telegram">Telegram</label><input id="identity-telegram" maxLength={100} placeholder="@username" value={profile.telegram} onChange={e => update('telegram', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-discord">Discord</label><input id="identity-discord" maxLength={100} placeholder="Username" value={profile.discord} onChange={e => update('discord', e.target.value)} /></div>
            <div className="field"><label htmlFor="identity-linkedin">LinkedIn</label><input id="identity-linkedin" maxLength={160} placeholder="Profile URL" value={profile.linkedin} onChange={e => update('linkedin', e.target.value)} /></div>
          </div>
          </fieldset>
          <div className="kh-identity-section-save"><span>Social links stay editable. Save to update the links stored in your KingsHall account.</span><button className="submit-button" type="button" onClick={() => void saveSocials()} disabled={savingSocials || savingPersonal || loading}>{savingSocials ? <LoadingDots /> : 'Save Socials'}</button></div>
        </section>
        
      </form>
      <p className="kh-identity-footnote">Never enter a wallet seed phrase, private key, exchange password, or recovery phrase here. Use only public receiving addresses.</p>

      {nativePickerKind && <NativeGalleryModal onClose={() => setNativePickerKind(null)} onSelect={file => { const source = URL.createObjectURL(file); if (nativePickerKind === 'profile') setPhotoCropSource(source); else setCoverCropSource(source); setNativePickerKind(null); setNotice(''); }} />}
      {photoCropSource && <StoryImageCropModal imageUrl={photoCropSource} title="Edit profile photo" aspectRatio={1} onCancel={() => { URL.revokeObjectURL(photoCropSource); setPhotoCropSource(null); }} onDone={file => uploadCroppedPhoto(file, 'profile')} />}
      {coverCropSource && <StoryImageCropModal imageUrl={coverCropSource} title="Edit cover photo" aspectRatio={3} onCancel={() => { URL.revokeObjectURL(coverCropSource); setCoverCropSource(null); }} onDone={file => uploadCroppedPhoto(file, 'cover')} />}
      {photoPreview && <ImagePreviewModal imageUrl={photoPreview} onClose={() => setPhotoPreview(null)} />}
      {coverPreview && <ImagePreviewModal imageUrl={coverPreview} onClose={() => setCoverPreview(null)} />}
  </div>;
}
function FeatureIconPlaceholder({ type }: { type: 'person' | 'wallet' | 'lock' }) {
  const path = type === 'person' ? 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0' : type === 'wallet' ? 'M4 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12 M16 12h5' : 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}

function PhotoActionGlyph({ type }: { type: 'upload' | 'view' | 'delete' }) {
  const path = type === 'upload' ? 'M12 16V4 M7 9l5-5 5 5 M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4' : type === 'view' ? 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' : 'M4 7h16 M9 7V4h6v3 M7 7l1 13h8l1-13 M10 10v7 M14 10v7';
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={path} /></svg>;
}
