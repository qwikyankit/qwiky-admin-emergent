import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../constants/theme';


const HoodItemsSection = ({  
  hoodItems,
  handleToggleAvailability,
  openPriceModal
 }) => {
  return (
   <View style={styles.section}>
   
     <View style={styles.sectionHeader}>
       <Ionicons
         name="pricetag-outline"
         size={22}
         color={THEME.colors.primary}
       />
       <Text style={styles.sectionTitle}>
         Hood Items
       </Text>
     </View>
   <ScrollView
     horizontal
     showsHorizontalScrollIndicator={false}
     contentContainerStyle={{
       paddingVertical: 8,
     }}
   >
     {hoodItems.map((item) => {
      const effectivePrice =
     item.offerPrice ??
     item.itemDefaultPrice;
   
   const discount =
     item.offerPrice
       ? item.itemDefaultPrice - item.offerPrice
       : 0;
   
       return (
         <View
           key={item.id}
           style={styles.serviceCard}
         >
    <View style={styles.cardHeader}>
     <TouchableOpacity
       style={[
         styles.serviceToggle,
         item.isAvailable
           ? styles.serviceToggleOn
           : styles.serviceToggleOff,
       ]}
       onPress={() =>
         handleToggleAvailability(item)
       }
     >
       <View
         style={[
           styles.serviceToggleThumb,
           item.isAvailable
             ? styles.serviceToggleThumbRight
             : styles.serviceToggleThumbLeft,
         ]}
       />
     </TouchableOpacity>
   
     <TouchableOpacity
       onPress={() => openPriceModal(item)}
     >
       <Ionicons
         name="create-outline"
         size={20}
         color={THEME.colors.primary}
       />
     </TouchableOpacity>
   </View>
           
   
           <Text style={styles.serviceTitle}>
             {item.productName}
           </Text>
   
         <View style={styles.priceRow}>
           
     <Text style={styles.offerPrice}>
       ₹{effectivePrice}
     </Text>
   
     {item.offerPrice && (
       <Text style={styles.strikePrice}>
         ₹{item.itemDefaultPrice}
       </Text>
     )}
   </View>
   {discount > 0 && (
     <View style={styles.discountBadge}>
       <Text style={styles.discountText}>
         Save ₹{discount}
       </Text>
     </View>
   )}
   </View>
       );
     })}
   </ScrollView>
   </View>
  )}
  
  export default HoodItemsSection;

  const styles = StyleSheet.create({ 
    section: {
  marginTop: 24,
},

sectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},

sectionTitle: {
  fontSize: 20,
  fontWeight: '700',
  marginLeft: 10,
},

serviceCard: {
  width: 180,
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 16,
  marginRight: 12,
  minHeight: 180,
  justifyContent: 'space-between',
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.06,
  shadowRadius: 6,
  elevation: 2,
},discountBadge: {
  alignSelf: 'center',
  marginTop: 10,
  backgroundColor: '#F3E8FF',
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 6,
},
discountText: {
  color: THEME.colors.primary,
  fontWeight: '700',
  fontSize: 13,
},
serviceTitle: {
  fontSize: 18,
  fontWeight: '700',
  textAlign: 'center',
  marginTop: 18,
  color: THEME.colors.primary,
},

priceRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 16,
},

offerPrice: {
  fontSize: 28,
  fontWeight: '800',
  color: '#111',
},
strikePrice: {
  marginLeft: 8,
  textDecorationLine: 'line-through',
  color: '#9CA3AF',
  fontSize: 22,
  fontWeight: '500',
},cardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

serviceToggle: {
  width: 38,
  height: 22,
  borderRadius: 20,
  padding: 2,
  justifyContent: 'center',
},

serviceToggleOn: {
  backgroundColor: '#22C55E',
},

serviceToggleOff: {
  backgroundColor: '#D1D5DB',
},

serviceToggleThumb: {
width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#FFF',
},

serviceToggleThumbRight: {
   transform: [{ translateX: 16 }],
},

serviceToggleThumbLeft: {
 transform: [{ translateX: 0 }],
},})