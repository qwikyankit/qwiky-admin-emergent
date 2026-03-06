import React, { useState, useEffect, useRef } from 'react';
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
Switch
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import THEME from '../constants/theme';
import {
validateUserByMobile,
fetchHoodItems,
fetchSlots,
createAssistedBooking
} from '../services/api';

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

const [newUser,setNewUser] = useState({name:'',email:''});

const [newAddress,setNewAddress] = useState({
line1:'',
line2:'',
city:'',
state:'',
pinCode:''
});

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
}

}catch(err){

if(err?.response?.status===400){
setUser(null);
setAddresses([]);
}else{
Alert.alert('Error','User validation failed');
}

}finally{
setLoading(false);
}

goToStep(2);
};

const loadItems = async()=>{

if(user && addresses.length>0 && !selectedAddress){
return Alert.alert('Select address');
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

try{

setLoading(true);

const body={
hoodItemId:selectedItem.id,
itemQuantity:1,
slotStart:selectedTimeSlot.start,
paymentMode:isCash?'POST_PAYMENT':'PRE_PAYMENT'
};

if(user){

body.userId=user.id;

if(addresses.length>0){
body.addressId=selectedAddress;
}else{
body.addressRequest=newAddress;
}

}else{

body.userRequest={
mobileNumber:mobile,
countryCode:'91',
name:newUser.name,
email:newUser.email,
roles:['CUSTOMER'],
createdBy:'ADMIN',
status:'INACTIVE'
};
body.addressRequest=newAddress;
}

const booking = await createAssistedBooking(body);
setBookingResponse(booking);
goToStep(6);

Alert.alert('Success','Booking created',[
{text:'OK',onPress:()=>router.replace('/')}
]);

}catch{
Alert.alert('Booking failed');
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

const goToStep = (nextStep) => {

  Animated.timing(progressAnim, {
    toValue: (nextStep - 1) / 5,
    duration: 300,
    useNativeDriver: false
  }).start();

  setStep(nextStep);
};

return(

<View style={{flex:1,backgroundColor:'#FFF'}}>

<View style={styles.topHeader}>
<TouchableOpacity onPress={()=>router.replace('/')}>
<Text style={styles.closeBtn}>✕</Text>
</TouchableOpacity>
</View>

<ScrollView ref={scrollRef} style={styles.container}>

{/* Progress Bar */}

<View style={styles.progressBarBackground}>
  <Animated.View
    style={[styles.progressBar, { width: progressWidth }]}
  />
</View>

{/* Back Button */}

{step > 1 && (
  <TouchableOpacity
    style={{ marginBottom: 10 }}
    onPress={handleBack}
  >
    <Text style={{ color: THEME.colors.primary }}>
      ← Back
    </Text>
  </TouchableOpacity>
)}

<Text style={{ marginBottom: 8, color: "#6B7280" }}>
Step {step} of 6
</Text>

{/* STEP 1 */}

{step===1 &&(

<>
<Text style={styles.title}>Enter Mobile</Text>

<TextInput
style={styles.input}
keyboardType="numeric"
placeholder="Mobile"
value={mobile}
onChangeText={setMobile}
/>

<TouchableOpacity style={styles.primaryBtn} onPress={validateUser}>
{loading
? <ActivityIndicator color="#FFF"/>
: <Text style={styles.btnText}>Next</Text>}
</TouchableOpacity>

</>

)}

{/* STEP 2 */}

{step===2 &&(

<>

{user && addresses.length>0 &&(

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

{(!user || addresses.length===0) &&(

<>

<Text style={styles.title}>
{user?'Add Address':'Create User'}
</Text>

{!user &&(
<>
<TextInput style={styles.input} placeholder="Name"
onChangeText={(v)=>setNewUser({...newUser,name:v})}/>

<TextInput style={styles.input} placeholder="Email"
onChangeText={(v)=>setNewUser({...newUser,email:v})}/>
</>
)}

<TextInput style={styles.input} placeholder="Address"
onChangeText={(v)=>setNewAddress({...newAddress,line1:v})}/>

<TextInput style={styles.input} placeholder="City"
onChangeText={(v)=>setNewAddress({...newAddress,city:v})}/>

<TextInput style={styles.input} placeholder="State"
onChangeText={(v)=>setNewAddress({...newAddress,state:v})}/>

<TextInput style={styles.input} placeholder="Pin"
keyboardType="numeric"
onChangeText={(v)=>setNewAddress({...newAddress,pinCode:v})}/>

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
</View>
);
}

const styles = StyleSheet.create({

container:{flex:1,padding:20},

title:{fontSize:18,fontWeight:'700',marginVertical:12},

input:{
borderWidth:1,
borderColor:'#E5E7EB',
borderRadius:12,
padding:12,
marginBottom:10
},

primaryBtn:{
backgroundColor:THEME.colors.primary,
padding:14,
borderRadius:12,
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
backgroundColor:'#EEF2FF'
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
backgroundColor:'#EEF2FF',
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
backgroundColor:'#EEF2FF',
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
backgroundColor:'#EEF2FF'
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