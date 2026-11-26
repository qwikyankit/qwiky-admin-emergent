import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
View,
Text,
StyleSheet,
TextInput,
TouchableOpacity,
ActivityIndicator,
ScrollView,
Alert,
Animated,
Switch,
Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import THEME from '../constants/theme';
import {
validateUserByMobile,
fetchHoodItems,
fetchSlots,
createAssistedBooking,
getErrorMessage
} from '../services/api';

const BLOCKED_PLACEHOLDERS = new Set(['na', 'n/a', 'null']);

const normalizeText = value =>
  value == null ? '' : String(value).trim().replace(/\s+/g, ' ');

const validateName = value => {
  const normalized = normalizeText(value);
  if (!normalized || BLOCKED_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return 'Please enter a valid name';
  }
  if (normalized.length > 100) return 'Name must not exceed 100 characters';
  return '';
};

const validateCity = value => {
  const normalized = normalizeText(value);
  if (!normalized || BLOCKED_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return 'Please provide a valid city';
  }
  return '';
};

const validateCoordinates = (latitudeValue, longitudeValue) => {
  if (latitudeValue === '' || latitudeValue == null) return 'Latitude is required';
  if (longitudeValue === '' || longitudeValue == null) return 'Longitude is required';

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return 'Latitude must be between -90 and 90';
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return 'Longitude must be between -180 and 180';
  }
  if (latitude === 0 && longitude === 0) return 'Select a valid location, not 0, 0';
  return '';
};

const buildMapHtml = (apiKey, latitudeValue, longitudeValue) => {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  const hasLocation =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0);
  const centre = hasLocation
    ? { lat: latitude, lng: longitude }
    : { lat: 20.5937, lng: 78.9629 };

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; }
      body { font-family: system-ui, sans-serif; }
      #hint { position: absolute; z-index: 2; left: 12px; right: 12px; top: 12px; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,.94); color: #463129; font-size: 13px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,.15); text-align: center; }
    </style>
  </head>
  <body>
    <div id="hint">Tap the map to choose the customer location</div>
    <div id="map"></div>
    <script>
      const initialCentre = ${JSON.stringify(centre)};
      const hasInitialLocation = ${JSON.stringify(hasLocation)};
      const sendLocation = location => {
        const message = JSON.stringify({ type: 'location-selected', latitude: location.lat(), longitude: location.lng() });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        if (window.parent) window.parent.postMessage(message, '*');
      };
      window.initMap = () => {
        const map = new google.maps.Map(document.getElementById('map'), {
          center: initialCentre,
          zoom: hasInitialLocation ? 17 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        let marker = hasInitialLocation ? new google.maps.Marker({ map, position: initialCentre }) : null;
        map.addListener('click', event => {
          if (!marker) marker = new google.maps.Marker({ map });
          marker.setPosition(event.latLng);
          map.panTo(event.latLng);
          map.setZoom(Math.max(map.getZoom(), 16));
          sendLocation(event.latLng);
        });
      };
    </script>
    <script async defer src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initMap&v=weekly"></script>
  </body>
</html>`;
};

const AddressLocationPicker = ({ latitude, longitude, onLocationChange }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const receiveLocation = event => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'location-selected') {
          onLocationChange(data.latitude, data.longitude);
        }
      } catch {
        // Ignore messages from other embedded content.
      }
    };
    window.addEventListener('message', receiveLocation);
    return () => window.removeEventListener('message', receiveLocation);
  }, [onLocationChange]);

  if (!googleMapsApiKey) {
    return (
      <View style={styles.locationHelp}>
        <Ionicons name="information-circle-outline" size={19} color={THEME.colors.primary} />
        <Text style={styles.locationHelpText}>
          Enter the latitude and longitude below. Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to also select the location on a map.
        </Text>
      </View>
    );
  }

  const mapHtml = buildMapHtml(googleMapsApiKey, latitude, longitude);
  if (Platform.OS === 'web') {
    return (
      <View style={styles.mapPicker}>
        <iframe
          title="Select customer location"
          srcDoc={mapHtml}
          style={{ width: '100%', height: 300, border: 0 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.mapPicker}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        onMessage={event => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === 'location-selected') {
              onLocationChange(data.latitude, data.longitude);
            }
          } catch {
            // Ignore malformed map messages.
          }
        }}
      />
    </View>
  );
};

export default function AssistedBooking(){

const router = useRouter();
const { hoodId } = useLocalSearchParams();

const scrollRef = useRef();

const [step,setStep] = useState(1);
const [loading,setLoading] = useState(false);

const progressAnim = useRef(new Animated.Value(0)).current;

const [mobile,setMobile] = useState('');

const [user,setUser] = useState(null);
const [addresses,setAddresses] = useState([]);
const [selectedAddress,setSelectedAddress] = useState(null);
const [useManualAddress,setUseManualAddress] = useState(false);

const [newUser,setNewUser] = useState({name:'',email:''});

const [newAddress,setNewAddress] = useState({
line1:'',
line2:'',
city:'',
state:'',
pinCode:'',
latitude:'',
longitude:'',
title: 'Home',
isDefault: true
});
const [formErrors,setFormErrors] = useState({});

const [items,setItems] = useState([]);

const [selectedDate,setSelectedDate] = useState(new Date());
const [selectedItem,setSelectedItem] = useState(null);
const [selectedSession,setSelectedSession] = useState(0);

const sessions = ['Morning','Afternoon','Evening'];

const [availableSlots,setAvailableSlots] = useState({
Morning:[],
Afternoon:[],
Evening:[]
});

const [selectedTimeSlot,setSelectedTimeSlot] = useState(null);
const [bookingResponse, setBookingResponse] = useState(null);

const [isCash,setIsCash] = useState(true);

const updateAddress = (field, value) => {
  setNewAddress(current => ({ ...current, [field]: value }));
  setFormErrors(current => {
    const next = { ...current };
    if (field === 'city') next.city = validateCity(value);
    if (field === 'latitude' || field === 'longitude') {
      const latitude = field === 'latitude' ? value : newAddress.latitude;
      const longitude = field === 'longitude' ? value : newAddress.longitude;
      next.coordinates = validateCoordinates(latitude, longitude);
    }
    return next;
  });
};

const selectMapLocation = useCallback((latitude, longitude) => {
  const nextLatitude = Number(latitude).toFixed(6);
  const nextLongitude = Number(longitude).toFixed(6);
  setNewAddress(current => ({
    ...current,
    latitude: nextLatitude,
    longitude: nextLongitude,
  }));
  setFormErrors(current => ({ ...current, coordinates: '' }));
}, []);

const validateManualDetails = () => {
  const errors = {};
  if (!newAddress.line1.trim()) errors.line1 = 'Address is required';
  errors.city = validateCity(newAddress.city);
  if (!newAddress.state.trim()) errors.state = 'State is required';
  if (!newAddress.pinCode.trim()) errors.pinCode = 'PIN code is required';
  errors.coordinates = validateCoordinates(newAddress.latitude, newAddress.longitude);
  if (!user) errors.name = validateName(newUser.name);

  const visibleErrors = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => Boolean(message)),
  );
  setFormErrors(visibleErrors);
  return Object.keys(visibleErrors).length === 0;
};


const validateUser = async()=>{

if(!mobile || mobile.length!==10){
return Alert.alert('Validation','Enter valid mobile');
}

try{

setLoading(true);

const res = await validateUserByMobile(mobile);

if(res?.id){
setUser(res);
setAddresses(res.addresses || []);
setUseManualAddress(false);
setSelectedAddress(null);
setFormErrors({});
}

}catch(err){

if(err?.response?.status===400){
setUser(null);
setAddresses([]);
setUseManualAddress(true);
}else{
Alert.alert('Error','User validation failed');
}

}finally{
setLoading(false);
}

goToStep(2);
};

const loadItems = async()=>{

if(user && addresses.length>0 && !useManualAddress && !selectedAddress){
return Alert.alert('Select address');
}

if(
  (!user || addresses.length===0 || useManualAddress) &&
  !validateManualDetails()
){
return Alert.alert('Complete address','Correct the highlighted customer and location details');
}

try{

setLoading(true);

const res = await fetchHoodItems(hoodId);

if(!res?.length){
Alert.alert('No services available');
return;
}

setItems(res);

goToStep(3);

}catch{
Alert.alert('Failed to load services');
}
finally{
setLoading(false);
}
};

const loadSlots = async(itemId,dateObj)=>{

try{

setLoading(true);

const dateStr = dateObj.toISOString().split('T')[0];

const res = await fetchSlots(itemId,dateStr);

const rawSlots = res?.slots || [];

const available = rawSlots.filter(s=>s.available);

const grouped={
Morning:[],
Afternoon:[],
Evening:[]
};

available.forEach(slot=>{

const hour = new Date(slot.start).getHours();

if(hour<12) grouped.Morning.push(slot);
else if(hour<17) grouped.Afternoon.push(slot);
else grouped.Evening.push(slot);

});

setAvailableSlots(grouped);

}catch{
Alert.alert('Failed to fetch slots');
}
finally{
setLoading(false);
}
};

const confirmBooking = async()=>{

if(!selectedTimeSlot){
return Alert.alert('Select slot');
}

const needsManualAddress = !user || addresses.length === 0 || useManualAddress;
if (needsManualAddress && !validateManualDetails()) {
  goToStep(2);
  return Alert.alert('Complete address', 'Correct the highlighted customer and location details');
}

try{

setLoading(true);

const normalizedAddress = {
  ...newAddress,
  line1: newAddress.line1.trim(),
  line2: newAddress.line2.trim(),
  city: normalizeText(newAddress.city),
  state: newAddress.state.trim(),
  pinCode: newAddress.pinCode.trim(),
  latitude: Number(newAddress.latitude),
  longitude: Number(newAddress.longitude),
};

const body={
hoodItemId:selectedItem.id,
itemQuantity:1,
slotStart:selectedTimeSlot.start,
paymentMode:isCash?'POST_PAYMENT':'PRE_PAYMENT'
};

if(user){

body.userId=user.id;

if(addresses.length>0 && !useManualAddress){
body.addressId=selectedAddress;
}else{
body.addressRequest=normalizedAddress;
}

}else{

body.userRequest={
mobileNumber:mobile,
countryCode:'91',
name:normalizeText(newUser.name),
email:newUser.email,
roles:['CUSTOMER'],
createdBy:'ADMIN',
status:'INACTIVE'
};
body.addressRequest=normalizedAddress;
}

const booking = await createAssistedBooking(body);
setBookingResponse(booking);
goToStep(6);

Alert.alert('Success','Booking created',[
{text:'OK',onPress:()=>router.replace('/')}
]);

}catch(error){
const code = error?.apiCode || error?.response?.data?.code;
const message = getErrorMessage(error);
if (code === 'INVALID_NAME') {
  setFormErrors(current => ({ ...current, name: message }));
  goToStep(2);
} else if (code === 'INVALID_CITY') {
  setFormErrors(current => ({ ...current, city: message }));
  goToStep(2);
} else if (['LATITUDE_REQUIRED', 'LONGITUDE_REQUIRED', 'INVALID_COORDINATES'].includes(code)) {
  setFormErrors(current => ({ ...current, coordinates: message }));
  goToStep(2);
}
Alert.alert('Booking failed', message);
}
finally{
setLoading(false);
}
};

const handleBack=()=>{
if(step===5) return setStep(3);
if(step===3) return setStep(2);
if(step===2) return setStep(1);
router.replace('/');
};

const scrollToSlots=()=>{
setTimeout(()=>{
scrollRef.current?.scrollTo({y:500,animated:true});
},300);
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);

  const hours = date.getHours();
  const minutes = date.getMinutes();

  const suffix = hours >= 12 ? "PM" : "AM";

  const formattedHour = hours % 12 || 12;

  if (minutes === 0) {
    return `${formattedHour}${suffix}`;
  }

  return `${formattedHour}:${minutes.toString().padStart(2, "0")}${suffix}`;
};

const resetBookingFlow = () => {

setStep(1);

setMobile('');
setUser(null);
setAddresses([]);
setSelectedAddress(null);
setUseManualAddress(false);
setNewUser({name:'',email:''});
setNewAddress({
line1:'',
line2:'',
city:'',
state:'',
pinCode:'',
latitude:'',
longitude:'',
title:'Home',
isDefault:true
});
setFormErrors({});

setSelectedItem(null);
setSelectedTimeSlot(null);

setAvailableSlots({
Morning:[],
Afternoon:[],
Evening:[]
});

};

const progressWidth = progressAnim.interpolate({
  inputRange: [0, 1],
  outputRange: ['0%', '100%'],
});

const confirmedBooking =
  bookingResponse?.booking ||
  bookingResponse?.bookingDetailsResponse ||
  bookingResponse;
const assignedExpert =
  confirmedBooking?.assignedExpert ||
  confirmedBooking?.assignedExpertResponse ||
  confirmedBooking?.expert ||
  confirmedBooking?.bookings?.find(booking => booking?.assignedExpert)
    ?.assignedExpert;
const assignedExpertName =
  assignedExpert?.expertName ||
  assignedExpert?.name ||
  assignedExpert?.userName ||
  confirmedBooking?.assignedExpertName ||
  confirmedBooking?.expertName;

const stepLabels = {
  1: 'Find customer',
  2: 'Customer and address',
  3: 'Service and schedule',
  5: 'Review booking',
  6: 'Booking confirmed',
};
const displayStep = ({ 1: 1, 2: 2, 3: 3, 5: 4, 6: 5 })[step] || 1;

const goToStep = (nextStep) => {

  Animated.timing(progressAnim, {
    toValue: (nextStep - 1) / 5,
    duration: 300,
    useNativeDriver: false
  }).start();

  setStep(nextStep);
};

return(

<SafeAreaView style={styles.screen} edges={['top']}>
<View style={styles.flowHeader}>
<TouchableOpacity style={styles.headerIcon} onPress={handleBack}>
<Ionicons name={step > 1 ? 'arrow-back' : 'close'} size={24} color={THEME.colors.text} />
</TouchableOpacity>
<View style={styles.headerCopy}>
<Text style={styles.headerTitle}>Assisted Booking</Text>
<Text style={styles.headerSubtitle}>{stepLabels[step]}</Text>
</View>
<View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{displayStep}/5</Text></View>
</View>

<ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>

{/* Progress Bar */}

<View style={styles.progressBarBackground}>
  <Animated.View
    style={[styles.progressBar, { width: progressWidth }]}
  />
</View>

{/* Back Button */}

<View style={styles.stepIntro}>
<Text style={styles.stepKicker}>STEP {displayStep} OF 5</Text>
<Text style={styles.stepTitle}>{stepLabels[step]}</Text>
</View>

{/* STEP 1 */}

{step===1 &&(

<>
<Text style={styles.helper}>Enter the customer’s registered mobile number to retrieve their profile and saved addresses.</Text>

<Text style={styles.fieldLabel}>Mobile number</Text>
<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="10-digit mobile number"
value={mobile}
onChangeText={(value)=>setMobile(value.replace(/\D/g,'').slice(0,10))}
/>

<TouchableOpacity style={styles.primaryBtn} onPress={validateUser}>
{loading
? <ActivityIndicator color="#FFF"/>
: <Text style={styles.btnText}>Continue</Text>}
</TouchableOpacity>

</>

)}

{/* STEP 2 */}

{step===2 &&(

<>

{user && addresses.length>0 && !useManualAddress &&(

<>
<Text style={styles.title}>Select Address</Text>

{addresses.map(addr=>{

const selected = selectedAddress===addr.id;

const formatted =
`${addr.line1}${addr.line2?`, ${addr.line2}`:''}, ${addr.city}, ${addr.state}`;

return(

<TouchableOpacity
key={addr.id}
style={[styles.radioRow,selected && styles.radioRowSelected]}
onPress={()=>setSelectedAddress(addr.id)}
>

<View style={styles.radioOuter}>
{selected && <View style={styles.radioInner}/>}
</View>

<Text style={styles.addressText}>{formatted}</Text>

</TouchableOpacity>

);

})}

</>

)}

{user && addresses.length>0 && (
<TouchableOpacity
style={styles.manualAddressButton}
onPress={()=>{
setUseManualAddress(current=>!current);
setSelectedAddress(null);
}}
>
<Ionicons
name={useManualAddress?'list-outline':'add-circle-outline'}
size={19}
color={THEME.colors.primary}
/>
<Text style={styles.manualAddressText}>
{useManualAddress?'Choose a saved address':'Enter a new address manually'}
</Text>
</TouchableOpacity>
)}

{(!user || addresses.length===0 || useManualAddress) &&(

<>

<Text style={styles.title}>
{user?'Add Address':'Create User'}
</Text>

{!user &&(
<>
<TextInput
style={[styles.input, formErrors.name && styles.inputError]}
placeholder="Name"
value={newUser.name}
onChangeText={(v)=>{
setNewUser(current=>({...current,name:v}));
setFormErrors(current=>({...current,name:validateName(v)}));
}}
/>
{!!formErrors.name && <Text style={styles.errorText}>{formErrors.name}</Text>}

<TextInput style={styles.input} placeholder="Email" value={newUser.email}
onChangeText={(v)=>setNewUser(current=>({...current,email:v}))}/>
</>
)}

<TextInput
style={[styles.input, formErrors.line1 && styles.inputError]}
placeholder="Address"
value={newAddress.line1}
onChangeText={(v)=>updateAddress('line1',v)}
/>
{!!formErrors.line1 && <Text style={styles.errorText}>{formErrors.line1}</Text>}

<TextInput
style={[styles.input, formErrors.city && styles.inputError]}
placeholder="City"
value={newAddress.city}
onChangeText={(v)=>updateAddress('city',v)}
/>
{!!formErrors.city && <Text style={styles.errorText}>{formErrors.city}</Text>}

<TextInput
style={[styles.input, formErrors.state && styles.inputError]}
placeholder="State"
value={newAddress.state}
onChangeText={(v)=>updateAddress('state',v)}
/>
{!!formErrors.state && <Text style={styles.errorText}>{formErrors.state}</Text>}

<TextInput
style={[styles.input, formErrors.pinCode && styles.inputError]}
placeholder="Pin"
value={newAddress.pinCode}
keyboardType="numeric"
onChangeText={(v)=>updateAddress('pinCode',v.replace(/\D/g,''))}
/>
{!!formErrors.pinCode && <Text style={styles.errorText}>{formErrors.pinCode}</Text>}

<Text style={styles.locationTitle}>Customer location</Text>
<Text style={styles.locationDescription}>
Enter coordinates or tap the exact address on the map. Both values are required for manual bookings.
</Text>
<AddressLocationPicker
latitude={newAddress.latitude}
longitude={newAddress.longitude}
onLocationChange={selectMapLocation}
/>
<View style={styles.coordinateInputs}>
<View style={styles.coordinateField}>
<Text style={styles.fieldLabel}>Latitude</Text>
<TextInput
style={[styles.input, formErrors.coordinates && styles.inputError]}
placeholder="e.g. 26.9124"
value={newAddress.latitude}
keyboardType="numbers-and-punctuation"
onChangeText={(v)=>updateAddress('latitude',v)}
/>
</View>
<View style={styles.coordinateField}>
<Text style={styles.fieldLabel}>Longitude</Text>
<TextInput
style={[styles.input, formErrors.coordinates && styles.inputError]}
placeholder="e.g. 75.7873"
value={newAddress.longitude}
keyboardType="numbers-and-punctuation"
onChangeText={(v)=>updateAddress('longitude',v)}
/>
</View>
</View>
{!!formErrors.coordinates && <Text style={styles.errorText}>{formErrors.coordinates}</Text>}

</>

)}

<TouchableOpacity style={styles.primaryBtn} onPress={loadItems}>
<Text style={styles.btnText}>Next</Text>
</TouchableOpacity>

</>

)}

{/* STEP 3 */}

{step===3 &&(

<>

<Text style={styles.title}>Select Date</Text>

<ScrollView horizontal showsHorizontalScrollIndicator={false}>

{[...Array(7)].map((_,i)=>{

const date=new Date();
date.setDate(date.getDate()+i);

const selected =
date.toDateString()===selectedDate.toDateString();

return(

<TouchableOpacity
key={i}
style={[styles.dateCard,selected && styles.selectedCard]}
onPress={()=>{

setSelectedDate(date);

setSelectedItem(null);
setSelectedSession(0);
setSelectedTimeSlot(null);

setAvailableSlots({
Morning:[],
Afternoon:[],
Evening:[]
});

}}
>

<Text style={styles.dateDay}>
{date.toLocaleDateString('en-IN',{weekday:'short'})}
</Text>

<Text style={styles.dateDate}>
{date.getDate()}
</Text>

</TouchableOpacity>

);

})}

</ScrollView>

<Text style={styles.title}>Select Duration</Text>

{items.map(item=>(

<TouchableOpacity
key={item.id}
style={[
styles.option,
selectedItem?.id===item.id && styles.selected
]}
onPress={()=>{

setSelectedItem(item);
setSelectedSession(0);
setSelectedTimeSlot(null);

loadSlots(item.id,selectedDate);

scrollToSlots();

}}
>

<Text>{item.productName} ₹{item.effectivePrice}</Text>

</TouchableOpacity>

))}

{selectedItem &&(

<>

<Text style={styles.title}>Select Slot</Text>

<View style={styles.sessionRow}>

{sessions.map((s,i)=>(
<TouchableOpacity
key={i}
style={[
styles.sessionTab,
selectedSession===i && styles.sessionSelected
]}
onPress={()=>setSelectedSession(i)}
>
<Text>{s}</Text>
</TouchableOpacity>
))}

</View>

<View style={styles.slotGrid}>
   

{loading ? (
<ActivityIndicator style={{marginTop:20}}/>
)

: availableSlots[sessions[selectedSession]].length===0 ? (

<Text style={styles.noSlotsText}>
No slots available
</Text>
)
: 
availableSlots[sessions[selectedSession]].map(slot=>(
<TouchableOpacity
key={slot.start}
style={[
styles.slotCard,
selectedTimeSlot?.start===slot.start && styles.selected
]}
onPress={()=>setSelectedTimeSlot(slot)}
>

<Text>{formatTime(slot.start)}</Text>
</TouchableOpacity>
    ))
 }
 <TouchableOpacity
style={styles.primaryBtn}
onPress={() => {

if (!selectedTimeSlot) {
  return Alert.alert("Select slot first");
}
goToStep(5);
}}
>
<Text style={styles.btnText}>Review Booking</Text>
</TouchableOpacity>
</View>
</>
)}
</>
)}

{/* STEP 5 */}
{step === 5 && (

<View>

<Text style={styles.title}>Review Booking</Text>

<View style={styles.reviewCard}>

<Text style={styles.reviewRow}>
Mobile: {mobile}
</Text>

<Text style={styles.reviewRow}>
Service: {selectedItem?.productName}
</Text>

<Text style={styles.reviewRow}>
Date: {selectedDate.toDateString()}
</Text>

<Text style={styles.reviewRow}>
Time: {formatTime(selectedTimeSlot.start)}
</Text>

<Text style={styles.reviewRow}>
Payment: {isCash ? "Cash" : "Online"}
</Text>

</View>

<View style={styles.cashRow}>
<Text>Mark as CASH</Text>
<Switch value={isCash} onValueChange={setIsCash}/>
</View>

<TouchableOpacity
style={styles.primaryBtn}
onPress={confirmBooking}
>

{loading
? <ActivityIndicator color="#FFF"/>
: <Text style={styles.btnText}>Confirm Booking</Text>}

</TouchableOpacity>

</View>

)}


{step === 6 && (

<View style={styles.confirmContainer}>

<Text style={styles.successIcon}>✅</Text>

<Text style={styles.successTitle}>
Booking Confirmed
</Text>

<Text style={styles.successText}>
Your booking has been successfully created
</Text>

<View style={styles.reviewCard}>

<Text>Booking ID: {bookingResponse?.id}</Text>

<Text>Service: {selectedItem?.productName}</Text>

<Text>Date: {selectedDate.toDateString()}</Text>

<Text>Time: {formatTime(selectedTimeSlot.start)}</Text>

<Text>
Assigned Expert: {assignedExpertName || 'Not assigned yet'}
</Text>

</View>

<TouchableOpacity
style={styles.primaryBtn}
onPress={resetBookingFlow}
>

<Text style={styles.btnText}>
New Booking
</Text>

</TouchableOpacity>

</View>

)}

</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({

screen:{flex:1,backgroundColor:THEME.colors.background},
flowHeader:{height:68,paddingHorizontal:14,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:THEME.colors.border,flexDirection:'row',alignItems:'center'},
headerIcon:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center'},
headerCopy:{flex:1,marginLeft:5},
headerTitle:{fontSize:19,fontWeight:'800',color:THEME.colors.text},
headerSubtitle:{marginTop:2,fontSize:11,color:THEME.colors.textSecondary},
stepBadge:{minWidth:42,paddingHorizontal:9,paddingVertical:7,borderRadius:999,backgroundColor:'#EFE3D8',alignItems:'center'},
stepBadgeText:{color:THEME.colors.primary,fontSize:11,fontWeight:'800'},
container:{flex:1},
content:{padding:20,paddingBottom:45},
stepIntro:{marginTop:16,marginBottom:12},
stepKicker:{color:THEME.colors.primary,fontSize:10,fontWeight:'900',letterSpacing:1},
stepTitle:{marginTop:4,fontSize:23,fontWeight:'900',color:THEME.colors.text},
helper:{marginBottom:18,color:THEME.colors.textSecondary,lineHeight:20},
fieldLabel:{marginBottom:7,color:THEME.colors.textSecondary,fontSize:12,fontWeight:'800'},

title:{fontSize:18,fontWeight:'800',marginTop:22,marginBottom:12,color:THEME.colors.text},

manualAddressButton:{minHeight:48,marginTop:8,paddingHorizontal:14,borderWidth:1,borderColor:THEME.colors.primary,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#F7F0E8'},
manualAddressText:{color:THEME.colors.primary,fontWeight:'800'},

input:{
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:13,
padding:14,
marginBottom:10
},
inputError:{
borderColor:THEME.colors.error,
},
errorText:{
marginTop:-5,
marginBottom:10,
color:THEME.colors.error,
fontSize:12,
fontWeight:'600',
},
locationTitle:{
marginTop:16,
marginBottom:5,
fontSize:16,
fontWeight:'800',
color:THEME.colors.text,
},
locationDescription:{
marginBottom:12,
color:THEME.colors.textSecondary,
fontSize:13,
lineHeight:19,
},
locationHelp:{
marginBottom:12,
padding:12,
borderRadius:12,
backgroundColor:'#F7F0E8',
flexDirection:'row',
gap:8,
},
locationHelpText:{
flex:1,
color:THEME.colors.textSecondary,
fontSize:12,
lineHeight:18,
},
mapPicker:{
height:300,
marginBottom:14,
borderWidth:1,
borderColor:THEME.colors.border,
borderRadius:14,
overflow:'hidden',
backgroundColor:'#F3F4F6',
},
coordinateInputs:{
flexDirection:'row',
gap:10,
},
coordinateField:{
flex:1,
},

primaryBtn:{
backgroundColor:THEME.colors.primary,
minHeight:50,
padding:14,
borderRadius:14,
alignItems:'center',
marginTop:12,
position: 'relative',
bottom: 0,
left: 0,
right: 0,
width: '100%',
},

btnText:{color:'#FFF',fontWeight:'600'},

option:{
padding:12,
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:12,
marginBottom:8
},

selected:{
borderColor:THEME.colors.primary,
backgroundColor:'#F2E6DC'
},

dateCard:{
padding:12,
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:12,
marginRight:10,
alignItems:'center',
width:70
},

selectedCard:{
backgroundColor:'#F2E6DC',
borderColor:THEME.colors.primary
},

dateDay:{fontSize:12,color:'#6B7280'},

dateDate:{fontSize:16,fontWeight:'700'},

sessionRow:{
flexDirection:'row',
justifyContent:'space-between',
marginVertical:10,
},

sessionTab:{
flex:1,
padding:10,
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:10,
alignItems:'center',
marginHorizontal:4
},

sessionSelected:{
backgroundColor:'#F2E6DC',
borderColor:THEME.colors.primary
},

slotGrid:{
flexDirection:'row',
flexWrap:'wrap',
justifyContent:'space-between',
},

slotCard:{
width:'30%',
padding:10,
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:10,
alignItems:'center',
marginVertical:6
},

noSlotsText:{
textAlign:'center',
width:'100%',
marginVertical:20,
color:'#6B7280'
},

radioRow:{
flexDirection:'row',
alignItems:'center',
padding:14,
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:14,
marginBottom:10
},

radioRowSelected:{
borderColor:THEME.colors.primary,
backgroundColor:'#F2E6DC'
},

radioOuter:{
width:22,
height:22,
borderRadius:11,
borderWidth:2,
borderColor:THEME.colors.primary,
alignItems:'center',
justifyContent:'center',
marginRight:12
},

radioInner:{
width:10,
height:10,
borderRadius:5,
backgroundColor:THEME.colors.primary
},

addressText:{
fontSize:14,
fontWeight:'500'
},

cashRow:{
flexDirection:'row',
justifyContent:'space-between',
alignItems:'center',
marginVertical:12
},

topHeader:{
flexDirection:'row',
justifyContent:'flex-end',
marginBottom:10
},

closeBtn:{
fontSize:24,
fontWeight:'700',
color:THEME.colors.primary,
padding: 16
},
reviewCard:{
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:14,
padding:16,
marginVertical:15,
backgroundColor:'#F9FAFB'
},

reviewRow:{
fontSize:15,
marginBottom:8
},
confirmContainer:{
alignItems:'center',
marginTop:40
},

successIcon:{
fontSize:60
},

successTitle:{
fontSize:22,
fontWeight:'700',
marginVertical:10
},

successText:{
color:'#6B7280',
marginBottom:20
}
});
