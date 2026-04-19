import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# 这是你从 BotFather 拿到的专属 Token
API_TOKEN = '8796959241:AAEutOxD46OnY6AZOpnZoYnTo_drP59GoOA'

# 这是你刚刚通过 Cloudflare 生成的公网内网穿透链接
WEB_APP_URL = 'https://aims-enquiry-percentage-networks.trycloudflare.com'

bot = Bot(token=API_TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def send_welcome(message: types.Message):
    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="⚽ 开启世界杯竞猜 (Play Now)", 
            web_app=WebAppInfo(url=WEB_APP_URL)
        )]
    ])
    
    welcome_text = (
        f"欢迎来到 TONStriker，{message.from_user.first_name}！🏆\n\n"
        "2026 世界杯狂欢已开启，预测比赛，赢取 $GOAL 积分，瓜分百万 TON 奖池。\n"
        "点击下方按钮，立刻进入小程序！"
    )
    
    await message.answer(welcome_text, reply_markup=markup)

async def main():
    print("🤖 TONStriker Bot 启动成功，正在监听 Telegram 消息...")
    await dp.start_polling(bot)

if __name__ == '__main__':
    asyncio.run(main())
    