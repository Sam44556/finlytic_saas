import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, parse } from 'date-fns';
import { generateGeminiText } from '@/lib/gemini-generate';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const dateFormat = formData.get('dateFormat') as string;
    const headerPresent = formData.get('headerPresent') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('CSV Import Request:', { 
      fileName: file.name, 
      fileSize: file.size, 
      dateFormat, 
      headerPresent, 
      userId: user.id 
    });

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Use AI to intelligently parse the CSV and extract transactions
    const prompt = `You are a financial data parser. Analyze this CSV/Excel data and extract transaction information.

**FILE CONTENT:**
\`\`\`
${lines.slice(0, 50).join('\n')}
${lines.length > 50 ? '\n... (file continues)' : ''}
\`\`\`

**PARSING INSTRUCTIONS:**
- Header row present: ${headerPresent ? 'YES' : 'NO'}
- Date format example: ${dateFormat}
- Total lines: ${lines.length}

**YOUR TASK:**
1. Identify which columns contain: Date, Amount, Type (income/expense), Category, Description
2. Parse each row and extract transaction data
3. Convert dates to YYYY-MM-DD format
4. Identify if transaction is income or expense (look for keywords, positive/negative amounts, or explicit type column)
5. Extract or infer category (if not present, use "Uncategorized")
6. Handle different CSV formats intelligently

**OUTPUT FORMAT:**
Return a JSON array of transactions. Each transaction must have:
{
  "date": "YYYY-MM-DD",
  "type": "income" or "expense",
  "amount": number (always positive),
  "category": "string",
  "description": "string or null"
}

**RULES:**
- Skip header row if present
- Skip empty or invalid rows
- Amounts should always be positive numbers
- If amount is negative, it's likely an expense
- If type is not clear, use context clues (salary = income, groceries = expense, etc.)
- Common income categories: Salary, Freelance, Investment, Gift, Refund
- Common expense categories: Food, Transport, Shopping, Bills, Entertainment, Healthcare, Education

**IMPORTANT:** Return ONLY the JSON array, no explanations or markdown. Start with [ and end with ].`;

    let aiResponse = (await generateGeminiText(genAI, prompt)).trim();

    // Clean up AI response (remove markdown if present)
    if (aiResponse.startsWith('```json')) {
      aiResponse = aiResponse.replace(/```json\n?/, '').replace(/```\s*$/, '');
    } else if (aiResponse.startsWith('```')) {
      aiResponse = aiResponse.replace(/```\n?/, '').replace(/```\s*$/, '');
    }

    // Parse the AI response
    let parsedTransactions: any[];
    try {
      parsedTransactions = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      throw new Error('AI failed to parse CSV correctly. Please check file format.');
    }

    if (!Array.isArray(parsedTransactions) || parsedTransactions.length === 0) {
      return NextResponse.json({ 
        error: 'No valid transactions found in file',
        details: 'The file may be empty or in an unsupported format'
      }, { status: 400 });
    }

    // Validate and prepare transactions for database
    const validTransactions = parsedTransactions
      .filter(tx => {
        // Validate required fields
        return tx.date && 
               tx.type && 
               (tx.type === 'income' || tx.type === 'expense') &&
               tx.amount && 
               !isNaN(Number(tx.amount)) &&
               Number(tx.amount) > 0;
      })
      .map(tx => ({
        user_id: user.id,
        date: tx.date,
        type: tx.type,
        amount: Math.abs(Number(tx.amount)), // Ensure positive
        category: tx.category || 'Uncategorized',
        description: tx.description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

    if (validTransactions.length === 0) {
      return NextResponse.json({ 
        error: 'No valid transactions after validation',
        details: 'All rows were invalid or missing required fields'
      }, { status: 400 });
    }

    // Insert transactions into database
    const { data: insertedTransactions, error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert(validTransactions)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save transactions: ' + insertError.message);
    }

    // Calculate summary statistics
    const totalImported = insertedTransactions?.length || 0;
    const incomeCount = validTransactions.filter(t => t.type === 'income').length;
    const expenseCount = validTransactions.filter(t => t.type === 'expense').length;
    const totalIncome = validTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = validTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${totalImported} transactions`,
      summary: {
        totalImported,
        incomeTransactions: incomeCount,
        expenseTransactions: expenseCount,
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netAmount: (totalIncome - totalExpenses).toFixed(2)
      },
      transactions: insertedTransactions
    }, { status: 200 });

  } catch (error: any) {
    console.error('CSV Import Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import CSV' },
      { status: 500 }
    );
  }
}
