const { createClient } = require('@supabase/supabase-js')

const url = 'https://rncqjyckqixulmazeolq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuY3FqeWNrcWl4dWxtYXplb2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDYwMTQsImV4cCI6MjA5OTEyMjAxNH0.zfTFEWQ_4NZZvuK5J8U7kiJwS6bCu0lwJFBe0ez-Tv8'

const supabase = createClient(url, key)

async function checkDuplicates() {
  const { data, error } = await supabase.from('shops').select('id, name, owner_id')
  if (error) {
    console.error("Error fetching shops:", error)
    return
  }

  const ownerMap = new Map()
  const duplicates = []

  for (const shop of data) {
    if (ownerMap.has(shop.owner_id)) {
      duplicates.push({ owner_id: shop.owner_id, shop1: ownerMap.get(shop.owner_id), shop2: shop })
    } else {
      ownerMap.set(shop.owner_id, shop)
    }
  }

  if (duplicates.length > 0) {
    console.log("Found duplicates:")
    console.log(JSON.stringify(duplicates, null, 2))
  } else {
    console.log("No duplicate owner_ids found in shops table.")
  }
}

checkDuplicates()
