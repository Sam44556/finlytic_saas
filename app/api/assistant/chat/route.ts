import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    console.log('AI Assistant - Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('AI Assistant - No authorization header');
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('AI Assistant - Token length:', token.length);
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.log('AI Assistant - Auth error:', authError.message);
      return NextResponse.json({ error: 'Unauthorized: ' + authError.message }, { status: 401 });
    }
    
    if (!user) {
      console.log('AI Assistant - No user found');
      return NextResponse.json({ error: 'Unauthorized: No user found' }, { status: 401 });
    }

    console.log('AI Assistant - User authenticated:', user.id);

    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch user's financial data from database
    const [profileRes, transactionsRes, budgetsRes, goalsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', user.id).single(),
      supabaseAdmin.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
      supabaseAdmin.from('budgets').select('*').eq('user_id', user.id),
      supabaseAdmin.from('goals').select('*').eq('user_id', user.id),
    ]);

    const profile = profileRes.data;
    const transactions = transactionsRes.data || [];
    const budgets = budgetsRes.data || [];
    const goals = goalsRes.data || [];

    // Calculate financial summary
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netBalance = totalIncome - totalExpenses;

    // Calculate spending by category
    const spendingByCategory: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense' && t.category)
      .forEach(t => {
        spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + Number(t.amount);
      });

    // Calculate current month spending
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const monthlyExpenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Calculate budget status
    const budgetStatus = budgets.map(budget => {
      const spent = monthlyTransactions
        .filter(t => t.type === 'expense' && t.category === budget.category)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const remaining = Number(budget.amount) - spent;
      const percentage = (spent / Number(budget.amount)) * 100;
      return {
        category: budget.category,
        budget: Number(budget.amount),
        spent,
        remaining,
        percentage: Math.round(percentage),
        status: percentage > 100 ? 'over' : percentage > 80 ? 'warning' : 'good'
      };
    });

    // Calculate goal progress
    const goalProgress = goals.map(goal => {
      const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
      return {
        name: goal.name,
        target: Number(goal.target_amount),
        current: Number(goal.current_amount),
        remaining: Number(goal.target_amount) - Number(goal.current_amount),
        progress: Math.round(progress),
        deadline: goal.deadline
      };
    });

    // Get top spending categories
    const topCategories = Object.entries(spendingByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }));

    // Recent transactions
    const recentTransactions = transactions.slice(0, 10).map(t => ({
      date: t.date,
      type: t.type,
      category: t.category || 'Uncategorized',
      amount: Number(t.amount),
      description: t.description
    }));

    // Try to use Gemini AI
    let aiResponse: string;
    
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
      }

      // Use gemini-1.5-flash model
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Create conversational prompt
      const prompt = `You are Finley, a friendly and knowledgeable personal finance AI assistant. You help users understand their finances and make better financial decisions.

PERSONALITY:
- Warm, conversational, and supportive (like talking to a helpful friend)
- Respond naturally to ALL types of messages: greetings, questions, statements, casual chat
- If user says "hi", "hello", "hey" - greet them warmly and ask how you can help
- If user asks vague questions, ask clarifying questions
- Use emojis to make conversations friendly: 💰 📊 🎯 ✅ ⚠️ 💡 🎉
- Be encouraging and motivating, never judgmental

USER'S MESSAGE: "${message}"

USER'S FINANCIAL DATA:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Balance: $${netBalance.toFixed(2)}
- This Month Income: $${monthlyIncome.toFixed(2)}
- This Month Expenses: $${monthlyExpenses.toFixed(2)}
- This Month Net: $${(monthlyIncome - monthlyExpenses).toFixed(2)}

${topCategories.length > 0 ? `TOP SPENDING CATEGORIES:
${topCategories.map((c, i) => `${i + 1}. ${c.category}: $${c.amount.toFixed(2)}`).join('\n')}` : 'No spending data yet - user hasn\'t added any expense transactions'}

${budgetStatus.length > 0 ? `BUDGET STATUS:
${budgetStatus.map(b => 
  `- ${b.category}: $${b.spent.toFixed(2)} spent of $${b.budget.toFixed(2)} budget (${b.percentage}% used) - ${b.status}`
).join('\n')}` : 'No budgets set yet'}

${goalProgress.length > 0 ? `SAVINGS GOALS:
${goalProgress.map(g => 
  `- ${g.name}: $${g.current.toFixed(2)} / $${g.target.toFixed(2)} (${g.progress}% complete)${g.deadline ? ` - Deadline: ${g.deadline}` : ''}`
).join('\n')}` : 'No savings goals set yet'}

${recentTransactions.length > 0 ? `RECENT TRANSACTIONS (last 5):
${recentTransactions.slice(0, 5).map(t => 
  `- ${t.date}: ${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)} - ${t.category}${t.description ? ` (${t.description})` : ''}`
).join('\n')}` : 'No transactions yet - user just started'}

HOW TO RESPOND:
1. **Greetings** (hi, hello, hey): Greet warmly and ask how you can help with their finances
2. **No Data**: If user has $0.00 everywhere, encourage them to start tracking transactions, budgets, and goals. Explain the benefits!
3. **Questions**: Answer using their actual data, be specific with numbers
4. **Vague questions**: Ask clarifying questions to understand better
5. **General advice**: Give personalized tips based on their situation
6. **Conversational**: Be natural and friendly, like chatting with a friend
7. **Format**: Use bullet points for lists, keep paragraphs short
8. **Numbers**: Always use $ and 2 decimals
9. **Emojis**: Use them to make responses visual and friendly

IMPORTANT: Respond naturally to ANY message type. Be conversational, helpful, and encouraging!

Now respond to the user:`;


      const result = await model.generateContent(prompt);
      const response = result.response;
      aiResponse = response.text();

      console.log('✅ Gemini AI response generated successfully');

    } catch (error: any) {
      console.error('Gemini AI Error:', error);
      console.log('⚠️ Falling back to simple response');
      
      // Simple fallback if Gemini fails
      if (transactions.length === 0) {
        aiResponse = `Hi there! 👋 I'm Finley, your personal finance AI assistant.\n\nI notice you haven't added any transactions yet. Let me help you get started! 🎯\n\n**Why track your finances?**\n- 💰 See exactly where your money goes\n- 📊 Stay within budget and avoid overspending\n- 🎯 Reach your savings goals faster\n- 💡 Get personalized financial advice\n\n**Get started:**\n1. Add some transactions (income and expenses)\n2. Set monthly budgets for your main categories\n3. Create savings goals you want to achieve\n\nOnce you have some data, I can give you detailed insights and advice! What would you like to know about managing your finances?`;
      } else {
        aiResponse = `I can help you with your finances! 💰\n\nYour current balance is $${netBalance.toFixed(2)} (Income: $${totalIncome.toFixed(2)}, Expenses: $${totalExpenses.toFixed(2)}).\n\nTry asking me:\n- "How much did I spend this month?"\n- "Am I over budget?"\n- "How are my savings goals?"\n- "Give me financial advice"\n\nWhat would you like to know?`;
      }
    }

    return NextResponse.json({ 
      response: aiResponse,
      context: {
        totalIncome,
        totalExpenses,
        netBalance,
        monthlyIncome,
        monthlyExpenses,
        budgetStatus,
        goalProgress
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('AI Assistant Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
