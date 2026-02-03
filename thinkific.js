require('dotenv').config();
const fetch = require('node-fetch');

const THINKIFIC_API_KEY = process.env.THINKIFIC_API_KEY;
const THINKIFIC_SUBDOMAIN = process.env.THINKIFIC_SUBDOMAIN;
const THINKIFIC_API_URL = `https://api.thinkific.com/api/public/v1`;

if (!THINKIFIC_API_KEY || THINKIFIC_API_KEY === 'your_thinkific_api_key') {
  console.error('⚠️ WARNING: THINKIFIC_API_KEY not set in .env file!');
}

async function thinkificRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'X-Auth-API-Key': THINKIFIC_API_KEY,
      'X-Auth-Subdomain': THINKIFIC_SUBDOMAIN,
      'Content-Type': 'application/json'
    }
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${THINKIFIC_API_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Thinkific API Error: ${response.status} - ${error}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('[Thinkific] API request error:', error);
    throw error;
  }
}

async function getUserByEmail(email) {
  try {
    const data = await thinkificRequest(`/users?query[email]=${encodeURIComponent(email)}`);
    
    if (data.items && data.items.length > 0) {
      return data.items[0];
    }
    
    return null;
    
  } catch (error) {
    console.error('[Thinkific] Get user error:', error);
    throw error;
  }
}

async function getUserById(userId) {
  try {
    const data = await thinkificRequest(`/users/${userId}`);
    return data;
    
  } catch (error) {
    console.error('[Thinkific] Get user by ID error:', error);
    throw error;
  }
}

async function checkSubscription(userId) {
  try {
    const PREMIUM_COURSE_ID = process.env.THINKIFIC_PREMIUM_COURSE_ID;
    
    if (PREMIUM_COURSE_ID) {
      const enrollments = await thinkificRequest(`/enrollments?query[user_id]=${userId}`);
      
      if (enrollments.items) {
        const isEnrolled = enrollments.items.some(
          enrollment => enrollment.course_id == PREMIUM_COURSE_ID && 
                       enrollment.activated_at !== null
        );
        
        if (isEnrolled) {
          return {
            subscribed: true,
            method: 'course_enrollment',
            details: 'User is enrolled in premium course'
          };
        }
      }
    }
    
    const user = await getUserById(userId);
    
    if (user.custom_profile_fields) {
      const subscriptionField = user.custom_profile_fields.find(
        field => field.name === 'subscription_status'
      );
      
      if (subscriptionField && subscriptionField.value === 'active') {
        return {
          subscribed: true,
          method: 'custom_field',
          details: 'User has active subscription status'
        };
      }
    }
    
    return {
      subscribed: false,
      method: 'not_found',
      details: 'No active subscription found'
    };
    
  } catch (error) {
    console.error('[Thinkific] Check subscription error:', error);
    
    return {
      subscribed: false,
      method: 'error',
      details: error.message
    };
  }
}

async function verifySubscription(userId, userEmail) {
  console.log(`[Thinkific] Verifying subscription for user: ${userId} (${userEmail})`);
  
  try {
    const result = await checkSubscription(userId);
    
    if (result.subscribed) {
      console.log(`[Thinkific] ✅ User ${userId} has active subscription`);
      return {
        valid: true,
        subscription: result
      };
    } else {
      console.log(`[Thinkific] ❌ User ${userId} does not have active subscription`);
      return {
        valid: false,
        subscription: result,
        message: '활성 구독이 없습니다. 구독 후 이용해주세요.'
      };
    }
    
  } catch (error) {
    console.error('[Thinkific] Verification error:', error);
    
    return {
      valid: false,
      error: true,
      message: '구독 확인 중 오류가 발생했습니다.'
    };
  }
}

async function getCourses() {
  try {
    const data = await thinkificRequest('/courses');
    return data.items || [];
    
  } catch (error) {
    console.error('[Thinkific] Get courses error:', error);
    throw error;
  }
}

module.exports = {
  getUserByEmail,
  getUserById,
  checkSubscription,
  verifySubscription,
  getCourses
};
 

